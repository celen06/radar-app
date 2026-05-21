import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function RadarApp() {
  const [xml1, setXml1] = useState(null);
  const [xml2, setXml2] = useState(null);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("convert");

  const readFile = (file, setter) => {
    const reader = new FileReader();
    reader.onload = e => setter(e.target.result);
    reader.readAsText(file);
  };

  const parseXML = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const elements = xmlDoc.getElementsByTagName("*");
    let parsed = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.children.length === 0 && el.textContent.trim()) {
        parsed.push({ tag: el.tagName, value: el.textContent });
      }
    }
    return parsed;
  };

  const exportToExcel = () => {
    if (!data.length) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
    XLSX.writeFile(workbook, `RADAR_${tab}_results.xlsx`);
  };

  const handleConvert = () => {
    if (!xml1) return;
    setData(parseXML(xml1));
  };

  const handleCompare = () => {
    if (!xml1 || !xml2) return;

    const d1 = parseXML(xml1);
    const d2 = parseXML(xml2);

    let results = [];

    d1.forEach(item1 => {
      const match = d2.find(item2 => item2.tag === item1.tag);

      if (!match) {
        results.push({ Parameter: item1.tag, Baseline: item1.value, Current: "Missing", Status: "Missing" });
      } else if (match.value !== item1.value) {
        results.push({ Parameter: item1.tag, Baseline: item1.value, Current: match.value, Status: "Changed" });
      }
    });

    setData(results);
  };

  const handleAudit = () => {
    if (!xml1) return;

    const parsed = parseXML(xml1);

    const rules = {
      qRxLevMin: { min: -140, max: -44 },
      pMax: { allowed: [10, 20, 23] },
      cellBarred: { allowed: ["false"] },
      threshXHigh: { min: 0, max: 31 },
      threshXLow: { min: 0, max: 31 }
    };

    let results = [];

    parsed.forEach(item => {
      const rule = rules[item.tag];
      if (!rule) return;

      let status = "OK";
      let expected = "";

      if (rule.min !== undefined && rule.max !== undefined) {
        expected = `${rule.min} to ${rule.max}`;
        const val = Number(item.value);
        if (val < rule.min || val > rule.max) status = "Fail";
      }

      if (rule.allowed) {
        expected = rule.allowed.join(", ");
        if (!rule.allowed.includes(item.value) && !rule.allowed.includes(Number(item.value))) {
          status = "Fail";
        }
      }

      if (status === "Fail") {
        results.push({ Parameter: item.tag, Value: item.value, Expected: expected, Status: status });
      }
    });

    setData(results);
  };

  const filteredData = data.filter(row =>
    (row.Parameter || row.tag)?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status) => {
    if (status === "Missing") return "red";
    if (status === "Changed") return "orange";
    if (status === "Fail") return "red";
    return "green";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>RADAR XML Analyzer</h1>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={() => setTab("convert")}>Convert</button>
        <button onClick={() => setTab("compare")}>Compare</button>
        <button onClick={() => setTab("audit")}>Audit</button>
      </div>

      <div style={{ border: "1px solid #ccc", padding: "10px" }}>
        <input type="file" accept=".xml" onChange={e => readFile(e.target.files[0], setXml1)} />
        {tab === "compare" && (
          <input type="file" accept=".xml" onChange={e => readFile(e.target.files[0], setXml2)} />
        )}

        <div style={{ marginTop: "10px" }}>
          {tab === "convert" && <button onClick={handleConvert}>Load XML</button>}
          {tab === "compare" && <button onClick={handleCompare}>Run Delta</button>}
          {tab === "audit" && <button onClick={handleAudit}>Run Audit</button>}
          <button onClick={exportToExcel}>Export Excel</button>
        </div>

        <div style={{ marginTop: "10px" }}>
          <input
            placeholder="Search parameter"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredData.length > 0 && (
        <table border="1" style={{ marginTop: "20px", width: "100%" }}>
          <thead>
            <tr>
              <th>Parameter</th>
              {tab === "compare" && <>
                <th>Baseline</th>
                <th>Current</th>
              </>}
              {tab === "audit" && <>
                <th>Value</th>
                <th>Expected</th>
              </>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, i) => (
              <tr key={i}>
                <td>{row.Parameter || row.tag}</td>
                {tab === "compare" && <>
                  <td>{row.Baseline}</td>
                  <td>{row.Current}</td>
                </>}
                {tab === "audit" && <>
                  <td>{row.Value}</td>
                  <td>{row.Expected}</td>
                </>}
                <td style={{ color: statusColor(row.Status) }}>
                  {row.Status || "OK"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}