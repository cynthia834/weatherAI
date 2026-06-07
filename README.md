# 🧪 PharmaLens | openFDA Drug Safety & Analytics Dashboard

PharmaLens is a premium, high-fidelity single-page web application that integrates real-time datasets from the **openFDA** developer platform to analyze medication safety, official drug labels, recall histories, and adverse event analytics.

Developed as a modern front-end project using **Vite**, **Vanilla JavaScript/CSS**, and **Chart.js**, it presents complex regulatory and clinical safety logs in clean, responsive, and glassmorphic dashboards.

---

## ✨ Features

- **📋 Live FDA Drug Labels**: Displays active ingredients, indications/usage, official boxed warnings, dosage instructions, and inactive ingredients.
- **📊 Real-Time Adverse Event Analytics**:
  - **Top 10 side-effects**: Analyzes reported patient events and plots the frequency of MedDRA Preferred Terms using a dynamic horizontal bar chart.
  - **Reported Outcomes**: Doughnut chart representing case outcomes including Death, Hospitalization, Disabling events, and Life-Threatening scenarios.
  - **Demographics**: Pie chart visual representing patient gender distribution.
- **🚨 FDA recalls & Enforcements**: Detailed cards outlining recall alerts, reasons for recall, classification categories (Class I/II/III), and status updates.
- **⚠️ Market Supply Shortages**: Live checks against FDA shortages records to notify users of market supply availability.

---

## 🛠️ Technology Stack

- **Core**: Vanilla JavaScript (ES6+), HTML5
- **Styling**: Modern Vanilla CSS (with custom properties, CSS Grid, Glassmorphic effects, and glowing orb background vectors)
- **Bundler & Server**: Vite
- **Visualizations**: Chart.js
- **API**: U.S. FDA openFDA REST API (`api.fda.gov`)

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Node.js (v18+)** and **npm** installed.

### Setup and Running
1. Clone or navigate to the repository directory:
   ```bash
   cd openfda-explorer
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```
   Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

4. Build the project for production:
   ```bash
   npm run build
   ```

---

## 📡 Endpoints Consumed
PharmaLens queries the following openFDA endpoints:
- **Label Endpoint**: `/drug/label.json` (for product indications, boxed warnings, and ingredients)
- **Event Endpoint**: `/drug/event.json` (for counting adverse reactions, outcomes, and gender ratios)
- **Enforcement Endpoint**: `/drug/enforcement.json` (for safety recalls and enforcement dates)
- **Shortages Endpoint**: `/drug/shortages.json` (for pharmaceutical market availability logs)

---

## ⚖️ Disclaimer
*PharmaLens is built using live public records provided by openFDA. This application is for educational and informational purposes only. It does not constitute medical advice and should never replace professional consultation with qualified healthcare providers.*
