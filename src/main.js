import Chart from 'chart.js/auto';

// Global Chart Instances to prevent overlap
let reactionsChartInstance = null;
let outcomesChartInstance = null;
let genderChartInstance = null;

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const quickButtons = document.querySelectorAll('.quick-btn');

const welcomeSection = document.getElementById('welcome-section');
const loaderSection = document.getElementById('loader-section');
const errorSection = document.getElementById('error-section');
const dashboardSection = document.getElementById('dashboard-section');

// Info DOM Elements
const drugTitle = document.getElementById('drug-title');
const drugIngredients = document.getElementById('drug-ingredients');
const drugIndications = document.getElementById('drug-indications');
const drugWarnings = document.getElementById('drug-warnings');
const drugDosage = document.getElementById('drug-dosage');
const drugInactive = document.getElementById('drug-inactive');

// Stats DOM Elements
const statTotalEvents = document.getElementById('stat-total-events');
const statSeriousRate = document.getElementById('stat-serious-rate');

// Tab DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const recallsList = document.getElementById('recalls-list');
const shortagesList = document.getElementById('shortages-list');

// Setup Clear button visibility
searchInput.addEventListener('input', () => {
  clearBtn.style.display = searchInput.value ? 'block' : 'none';
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  searchInput.focus();
});

// Setup Quick Search buttons
quickButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    searchInput.value = btn.textContent;
    clearBtn.style.display = 'block';
    handleSearch(btn.textContent);
  });
});

// Setup Form Submit
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    handleSearch(query);
  }
});

// Setup Tabs Navigation
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const targetPanel = document.getElementById(btn.getAttribute('data-tab'));
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  });
});

// Main Search Logic
async function handleSearch(drugName) {
  showState('loading');
  
  try {
    // 1. Fetch official FDA Drug Label
    const labelData = await fetchDrugLabel(drugName);
    if (!labelData) {
      showState('error', `No official FDA drug label found for "${drugName}".`, 'Verify the drug name is spelled correctly (e.g. Aspirin, Ibuprofen, Lipitor).');
      return;
    }
    
    // Resolve precise drug brand/generic name to query events, recalls, and shortages
    const resolvedName = getResolvedDrugName(labelData);
    
    // 2. Fetch all other data in parallel
    const [eventsStats, reactionsData, recallsData, shortagesData] = await Promise.all([
      fetchAdverseEventStats(resolvedName),
      fetchAdverseEventReactions(resolvedName),
      fetchRecalls(resolvedName),
      fetchShortages(resolvedName)
    ]);
    
    // 3. Render Dashboard
    renderLabelInfo(labelData);
    renderStats(eventsStats);
    renderReactionsChart(reactionsData);
    renderOutcomesChart(eventsStats);
    renderGenderChart(eventsStats);
    renderRecalls(recallsData);
    renderShortages(shortagesData);
    
    showState('dashboard');
  } catch (error) {
    console.error('Search failed:', error);
    showState('error', 'API Query Failure', 'An error occurred while communicating with the openFDA services. Please try again later.');
  }
}

// Show/Hide page states
function showState(state, errorTitle = '', errorMessage = '') {
  welcomeSection.classList.add('hidden');
  loaderSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  dashboardSection.classList.add('hidden');
  
  if (state === 'loading') {
    loaderSection.classList.remove('hidden');
  } else if (state === 'error') {
    document.getElementById('error-title').textContent = errorTitle;
    document.getElementById('error-message').textContent = errorMessage;
    errorSection.classList.remove('hidden');
  } else if (state === 'dashboard') {
    dashboardSection.classList.remove('hidden');
  } else {
    welcomeSection.classList.remove('hidden');
  }
}

// Fetch helper with fallbacks
async function fetchDrugLabel(drugName) {
  // Try exact brand name first, fallback to generic name, then generic search
  const queries = [
    `search=openfda.brand_name:"${drugName}"+OR+openfda.generic_name:"${drugName}"`,
    `search=openfda.brand_name:${encodeURIComponent(drugName)}+OR+openfda.generic_name:${encodeURIComponent(drugName)}`,
    `search=${encodeURIComponent(drugName)}`
  ];
  
  for (const query of queries) {
    try {
      const response = await fetch(`https://api.fda.gov/drug/label.json?${query}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0];
        }
      }
    } catch (err) {
      console.warn('Query attempt failed:', err);
    }
  }
  return null;
}

// Extract a clean searchable name from label data
function getResolvedDrugName(label) {
  if (label.openfda) {
    if (label.openfda.brand_name && label.openfda.brand_name.length > 0) {
      return label.openfda.brand_name[0];
    }
    if (label.openfda.generic_name && label.openfda.generic_name.length > 0) {
      return label.openfda.generic_name[0];
    }
  }
  return label.sponsor_name || '';
}

// Fetch Adverse Event Stats (Total counts of serious outcomes, genders)
async function fetchAdverseEventStats(drugName) {
  const cleanName = encodeURIComponent(drugName);
  
  // Parallel count fetches
  const urls = {
    total: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"&limit=1`,
    serious: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"+AND+serious:1&limit=1`,
    death: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"+AND+seriousnessdeath:1&limit=1`,
    hospitalization: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"+AND+seriousnesshospitalization:1&limit=1`,
    lifethreatening: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"+AND+seriousnesslifethreatening:1&limit=1`,
    disabling: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"+AND+seriousnessdisabling:1&limit=1`,
    genderCount: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"&count=patient.patientsex`
  };
  
  const stats = {
    total: 0,
    serious: 0,
    death: 0,
    hospitalization: 0,
    lifethreatening: 0,
    disabling: 0,
    gender: { male: 0, female: 0, unknown: 0 }
  };
  
  try {
    const keys = Object.keys(urls);
    const results = await Promise.all(
      keys.map(key => fetch(urls[key]).then(res => res.ok ? res.json() : null))
    );
    
    keys.forEach((key, index) => {
      const data = results[index];
      if (!data) return;
      
      if (key === 'genderCount') {
        if (data.results) {
          data.results.forEach(item => {
            if (item.term === 1) stats.gender.male = item.count;
            else if (item.term === 2) stats.gender.female = item.count;
            else stats.gender.unknown += item.count;
          });
        }
      } else {
        stats[key] = data.meta?.results?.total || 0;
      }
    });
  } catch (err) {
    console.error('Failed fetching stats:', err);
  }
  
  return stats;
}

// Fetch top reactions
async function fetchAdverseEventReactions(drugName) {
  try {
    const cleanName = encodeURIComponent(drugName);
    const response = await fetch(`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${cleanName}"&count=patient.reaction.reactionmeddrapt.exact`);
    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    }
  } catch (err) {
    console.error('Reactions fetch failed:', err);
  }
  return [];
}

// Fetch Recalls
async function fetchRecalls(drugName) {
  try {
    const cleanName = encodeURIComponent(drugName);
    const response = await fetch(`https://api.fda.gov/drug/enforcement.json?search=product_description:"${cleanName}"&limit=5`);
    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    }
  } catch (err) {
    console.error('Recalls fetch failed:', err);
  }
  return [];
}

// Fetch Shortages
async function fetchShortages(drugName) {
  try {
    const cleanName = encodeURIComponent(drugName);
    const response = await fetch(`https://api.fda.gov/drug/shortages.json?search=generic_name:"${cleanName}"+OR+brand_name:"${cleanName}"&limit=5`);
    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    }
  } catch (err) {
    console.error('Shortages fetch failed:', err);
  }
  return [];
}

// Render official Label Details
function renderLabelInfo(label) {
  const brand = label.openfda?.brand_name?.[0] || 'Unknown Brand';
  const generic = label.openfda?.generic_name?.[0] || 'Unknown Generic';
  
  drugTitle.textContent = brand;
  drugIngredients.innerHTML = `<strong>Active Ingredients:</strong> ${generic}`;
  
  drugIndications.textContent = label.indications_and_usage?.[0] || label.purpose?.[0] || 'No indication records recorded on this label.';
  
  // Format warning highlight
  if (label.boxed_warning?.[0]) {
    drugWarnings.innerHTML = `<div class="boxed-warning-block"><strong>BOXED WARNING:</strong><br/>${label.boxed_warning[0]}</div>`;
  } else if (label.warnings?.[0]) {
    drugWarnings.textContent = label.warnings[0];
  } else {
    drugWarnings.textContent = 'No specific warning registers on this label.';
  }
  
  drugDosage.textContent = label.dosage_and_administration?.[0] || 'No dosage records details found.';
  drugInactive.textContent = label.inactive_ingredient?.[0] || 'No inactive ingredient details recorded.';
}

// Render stats widgets
function renderStats(stats) {
  statTotalEvents.textContent = stats.total.toLocaleString();
  
  if (stats.total > 0) {
    const rate = ((stats.serious / stats.total) * 100).toFixed(1);
    statSeriousRate.textContent = `${rate}%`;
  } else {
    statSeriousRate.textContent = '0%';
  }
}

// Render Bar Chart for Side Effects
function renderReactionsChart(reactions) {
  if (reactionsChartInstance) {
    reactionsChartInstance.destroy();
  }
  
  const ctx = document.getElementById('reactions-chart').getContext('2d');
  
  // Use top 10
  const top10 = reactions.slice(0, 10);
  const labels = top10.map(r => r.term);
  const counts = top10.map(r => r.count);
  
  reactionsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Report Count',
        data: counts,
        backgroundColor: 'rgba(20, 184, 166, 0.6)',
        borderColor: '#14b8a6',
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(20, 184, 166, 0.85)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#f3f4f6', font: { family: 'Outfit', size: 12 } }
        }
      }
    }
  });
}

// Render Doughnut Chart for Outcomes
function renderOutcomesChart(stats) {
  if (outcomesChartInstance) {
    outcomesChartInstance.destroy();
  }
  
  const ctx = document.getElementById('outcomes-chart').getContext('2d');
  
  const outcomes = ['Death', 'Hospitalization', 'Life Threatening', 'Disabling'];
  const values = [stats.death, stats.hospitalization, stats.lifethreatening, stats.disabling];
  
  // Only display if we have data
  const totalOutcomes = values.reduce((a, b) => a + b, 0);
  
  outcomesChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: outcomes,
      datasets: [{
        data: totalOutcomes > 0 ? values : [1, 1, 1, 1], // fallback visually if empty
        backgroundColor: [
          '#ef4444', // Red for death
          '#f59e0b', // Amber for hosp
          '#3b82f6', // Blue for life thrt
          '#10b981'  // Emerald for disability
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#9ca3af',
            font: { family: 'Outfit', size: 11 },
            boxWidth: 10,
            padding: 8
          }
        },
        tooltip: {
          enabled: totalOutcomes > 0,
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const pct = ((val / stats.total) * 100).toFixed(1);
              return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Render Pie Chart for Demographics (Genders)
function renderGenderChart(stats) {
  if (genderChartInstance) {
    genderChartInstance.destroy();
  }
  
  const ctx = document.getElementById('age-chart').getContext('2d');
  const totalGenders = stats.gender.male + stats.gender.female + stats.gender.unknown;
  
  genderChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Female', 'Male', 'Unknown'],
      datasets: [{
        data: totalGenders > 0 ? [stats.gender.female, stats.gender.male, stats.gender.unknown] : [1, 1, 1],
        backgroundColor: [
          '#ec4899', // Pink
          '#06b6d4', // Cyan
          '#6b7280'  // Gray
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#9ca3af',
            font: { family: 'Outfit', size: 11 },
            boxWidth: 10,
            padding: 8
          }
        },
        tooltip: {
          enabled: totalGenders > 0,
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const pct = ((val / totalGenders) * 100).toFixed(1);
              return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// Render Recall lists
function renderRecalls(recalls) {
  recallsList.innerHTML = '';
  
  if (recalls.length === 0) {
    recallsList.innerHTML = '<p class="empty-list-message">No recall records found for this drug.</p>';
    return;
  }
  
  recalls.forEach(recall => {
    const card = document.createElement('div');
    card.className = 'list-item-card';
    
    const date = recall.recall_initiation_date 
      ? `${recall.recall_initiation_date.substring(0,4)}-${recall.recall_initiation_date.substring(4,6)}-${recall.recall_initiation_date.substring(6,8)}`
      : 'Unknown';
      
    const classification = recall.classification || 'Class II';
    let badgeClass = 'badge-warning';
    if (classification.includes('Class I ')) badgeClass = 'badge-danger';
    else if (classification.includes('Class III')) badgeClass = 'badge-success';
    
    card.innerHTML = `
      <div class="list-item-header">
        <span class="list-item-title">${recall.recalling_firm || 'Recalling Firm'}</span>
        <span class="item-badge ${badgeClass}">${classification}</span>
      </div>
      <p class="list-item-desc">${recall.reason_for_recall || 'No reason specified'}</p>
      <div class="list-item-meta">
        <span class="meta-item">Date: <strong>${date}</strong></span>
        <span class="meta-item">Status: <strong>${recall.status || 'Ongoing'}</strong></span>
        <span class="meta-item">Recall #: <strong>${recall.recall_number}</strong></span>
      </div>
    `;
    recallsList.appendChild(card);
  });
}

// Render Shortages lists
function renderShortages(shortages) {
  shortagesList.innerHTML = '';
  
  if (shortages.length === 0) {
    shortagesList.innerHTML = '<p class="empty-list-message">No shortage records found for this drug. It appears to be fully stocked.</p>';
    return;
  }
  
  shortages.forEach(shortage => {
    const card = document.createElement('div');
    card.className = 'list-item-card';
    
    card.innerHTML = `
      <div class="list-item-header">
        <span class="list-item-title">${shortage.brand_name || 'Generic Product'}</span>
        <span class="item-badge badge-warning">Shortage</span>
      </div>
      <p class="list-item-desc">${shortage.status || 'Currently in shortage list'}</p>
      <div class="list-item-meta">
        <span class="meta-item">Therapeutic Class: <strong>${shortage.therapeutic_class || 'N/A'}</strong></span>
      </div>
    `;
    shortagesList.appendChild(card);
  });
}
