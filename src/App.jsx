
import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function RadarApp() {
  const [xml1, setXml1] = useState(null);
  const [xml2, setXml2] = useState(null);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("convert");

  const readFile = (file, setter) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setter(e.target.result);
    reader.readAsText(file);
  };

  const parseXML = (xmlString) => {
    try {
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
    } catch (e) {
      console.error("XML parse error", e);
      return [];
    }
  };

  const exportToExcel = () => {
    console.log("Export clicked", data);

    if (!data || data.length === 0) {
      alert("No data to export!");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `RADAR_${tab}.xlsx`);
  };

  const handleConvert = () => {
    console.log("Convert clicked", xml1);

    if (!xml1) {
      alert("Upload XML file first");
      return;
    }

    const parsed = parseXML(xml1);
    setData(parsed);
  };

  const handleCompare = () => {
    console.log("Compare clicked", xml1, xml2);

    if (!xml1 || !xml2) {
      alert("Upload both XML files!");
      return;
    }

    const d1 = parseXML(xml1);
    const d2 = parseXML(xml2);

    let results = [];

    d1.forEach(item1 => {
      const match = d2.find(item2 => item2.tag === item1.tag);

      if (!match) {
        results.push({
          Parameter: item1.tag,
          Baseline: item1.value,
          Current: "Missing",
          Status: "Missing"
        });
      } else if (match.value !== item1.value) {
        results.push({
          Parameter: item1.tag,
          Baseline: item1.value,
          Current: match.value,
          Status: "Changed"
        });
      }
    });

    console.log("Compare results", results);
    setData(results);
  };

  const handleAudit = () => {
    console.log("Audit clicked", xml1);

    if (!xml1) {
      alert("Upload XML file first");
      return;
    }

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

      if (rule.min !== undefined) {
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
        results.push({
          Parameter: item.tag,
          Value: item.value,
          Expected: expected,
          Status: "Fail"
        });
      }
    });

    console.log("Audit results", results);
    setData(results);
  };

  const filteredData = (data || []).filter(row =>
    (row.Parameter || row.tag)?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status) => {
    if (status === "Missing") return "red";
    if (status === "Changed") return "orange";
    if (status === "Fail") return "red";
    return "lightgreen";
  };

  return (
    <div style={{ background: "#0f172a", color: "white", minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ color: "#38bdf8" }}>RADAR XML Analyzer</h1>

      {/* Tabs */}
      <div>
        {["convert", "compare", "audit"].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              margin: "5px",
              padding: "10px",
              background: tab === t ? "#38bdf8" : "#1e293b",
              color: "white"
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Upload */}
      <div style={{ padding: "10px", background: "#1e293b", marginTop: "15px" }}>
        <input
          type="file"
          accept=".xml"
          onChange={e => {
            readFile(e.target.files[0], setXml1);
            console.log("XML1 loaded");
          }}
        />

        {tab === "compare" && (
          <input
            type="file"
            accept=".xml"
            onChange={e => {
              readFile(e.target.files[0], setXml2);
              console.log("XML2 loaded");
            }}
          />
        )}

        <div style={{ marginTop: "10px" }}>
          {tab === "convert" && <button type="button" onClick={handleConvert}>Load XML</button>}
          {tab === "compare" && <button type="button" onClick={handleCompare}>Run Delta</button>}
          {tab === "audit" && <button type="button" onClick={handleAudit}>Run Audit</button>}
          <button type="button" onClick={exportToExcel}>Export Excel</button>
        </div>

        <input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginTop: "10px", width: "100%" }}
        />

        <p>Records: {data.length}</p>
      </div>

      {/* Table */}
      {filteredData.length > 0 && (
        <table style={{ width: "100%", marginTop: "20px" }}>
          <thead>
            <tr>
              <th>Parameter</th>
              {tab === "compare" && <><th>Baseline</th><th>Current</th></>}
              {tab === "audit" && <><th>Value</th><th>Expected</th></>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, i) => (
              <tr key={i}>
                <td>{row?.Parameter || row?.tag}</td>
                {tab === "compare" && <><td>{row?.Baseline}</td><td>{row?.Current}</td></>}
                {tab === "audit" && <><td>{row?.Value}</td><td>{row?.Expected}</td></>}
                <td style={{ color: statusColor(row?.Status) }}>{row?.Status || "OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
