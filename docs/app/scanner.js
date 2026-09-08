import { AppState } from './state.js';
import { $, escapeHtml } from './utils.js';
import { showToast, updateChecklist, switchTab } from './ui.js';

// URL detection helper for Indiana MyCase
export function isMyCaseUrl(url) {
  if (!url) return false;
  return url.includes('courts.in.gov/mycase') || url.includes('mycase.in.gov');
}

// ─── Scraper Parity Modal ──────────────────────────────────────────
/**
 * Show the parity confirmation modal after a scan.
 * Displays the extracted cases and asks the user to verify they match
 * what's on screen before merging into the accumulated batch.
 */
export function showParityModal(cases, searchContext, mergeMode) {
  if (cases && Array.isArray(cases)) {
    cases.forEach(c => {
      if (c.ccs && Array.isArray(c.ccs.charges) && c.ccs.charges.length > 0) {
        if (!c.charges || c.charges.toUpperCase().includes('SEE CCS ENTRY')) {
          c.charges = c.ccs.charges.map(ch => `${ch.count ? 'Count ' + ch.count + ': ' : ''}${ch.offense} (${ch.level || ''})`).join('; ');
        }
      }
    });
  }

  AppState.pendingScanResult = { cases, searchContext, mergeMode };

  const countEl = $('#parityCaseCount');
  const listEl = $('#parityCaseList');

  if (countEl) countEl.textContent = cases.length;

  if (listEl) {
    listEl.innerHTML = '';
    if (cases.length === 0) {
      listEl.innerHTML = '<tr><td colspan="4"><em style="font-size:0.7rem;color:var(--text-muted)">No cases found on this page.</em></td></tr>';
    } else {
      cases.slice(0, 20).forEach(c => {
        const item = document.createElement('tr');
        item.className = 'modal-case-item';
        item.innerHTML = `
          <td><span class="modal-case-num">${escapeHtml(c.case_number || 'Unknown')}</span></td>
          <td><span class="modal-case-type">${escapeHtml(c.case_type || '')}</span></td>
          <td><span class="modal-case-charges">${escapeHtml(c.charges || 'None')}</span></td>
          <td><span class="modal-case-date">${escapeHtml(c.filed || '')}</span></td>
        `;
        listEl.appendChild(item);
      });
      if (cases.length > 20) {
        const overflow = document.createElement('tr');
        overflow.innerHTML = `<td colspan="4" style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;">…and ${cases.length - 20} more case${cases.length - 20 === 1 ? '' : 's'}</td>`;
        listEl.appendChild(overflow);
      }
    }
  }

  const modal = $('#parityModal');
  if (modal) modal.style.display = 'flex';
}

$('#btnParityRetry')?.addEventListener('click', () => {
  const modal = $('#parityModal');
  if (modal) modal.style.display = 'none';
  AppState.pendingScanResult = null;
  showToast('Re-run the scan when you\'re ready.', 'info', 3000);
});

$('#btnParityConfirm')?.addEventListener('click', () => {
  const modal = $('#parityModal');
  if (modal) modal.style.display = 'none';

  if (!AppState.pendingScanResult) return;
  const { cases: incomingCases, searchContext, mergeMode } = AppState.pendingScanResult;
  AppState.pendingScanResult = null;

  if (incomingCases.length === 0) return;

  if (mergeMode && AppState.currentCases.length > 0) {
    const existingMap = new Map();
    AppState.currentCases.forEach(c => {
      const k = (c.case_number || '').trim().toUpperCase();
      if (k) existingMap.set(k, c);
    });

    let newAdded = 0;
    let overlapped = 0;

    incomingCases.forEach(ic => {
      const k = (ic.case_number || '').trim().toUpperCase();
      if (!k) return;

      if (existingMap.has(k)) {
        const existing = existingMap.get(k);
        if (!existing.searchQueries) {
          existing.searchQueries = existing.searchContext ? [existing.searchContext] : [];
        }
        if (!existing.searchQueries.includes(searchContext)) {
          existing.searchQueries.push(searchContext);
        }
        if (!existing.charges && ic.charges) existing.charges = ic.charges;
        if (!existing.court && ic.court) existing.court = ic.court;
        if (!existing.status && ic.status) existing.status = ic.status;
        if (ic.caseToken && !existing.caseToken) existing.caseToken = ic.caseToken;
        overlapped++;
      } else {
        ic.searchQueries = [searchContext];
        AppState.currentCases.push(ic);
        existingMap.set(k, ic);
        newAdded++;
      }
    });

    AppState.searchBatches.push({
      query: searchContext,
      count: incomingCases.length,
      timestamp: Date.now()
    });

    if (window.IndianaExpungement?.analyzeAll) {
      AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
    }

    showToast(
      newAdded > 0
        ? `Parity confirmed. Merged ${newAdded} new cases (${overlapped} already in batch). Total: ${AppState.currentCases.length} cases.`
        : `Parity confirmed. All ${overlapped} cases already in batch. Total: ${AppState.currentCases.length} cases.`,
      'success',
      5000
    );
  } else {
    AppState.currentCases = incomingCases;
    AppState.currentCases.forEach(c => {
      c.searchQueries = [searchContext];
    });
    AppState.searchBatches = [{
      query: searchContext,
      count: incomingCases.length,
      timestamp: Date.now()
    }];
    AppState.currentReport = window.IndianaExpungement?.analyzeAll
      ? window.IndianaExpungement.analyzeAll(AppState.currentCases)
      : null;

    showToast(`Parity confirmed. Found ${incomingCases.length} cases.`, 'success');
  }

  checkAndSuggestAlias(searchContext);
  updateBatchPanelUI();
  renderResults();

  persistScanResults();

  const deepBtn = $('#btnDeepScrape');
  if (deepBtn) deepBtn.disabled = false;
  switchTab('results');
  updateChecklist();
});

export function persistScanResults() {
  try {
    chrome?.runtime?.sendMessage?.({
      action: 'saveScanResults',
      cases: AppState.currentCases,
      report: AppState.currentReport,
      searchBatches: AppState.searchBatches
    });
  } catch (_) { /* ignore */ }
  try {
    localStorage.setItem('lastScanResults', JSON.stringify({
      cases: AppState.currentCases,
      report: AppState.currentReport,
      searchBatches: AppState.searchBatches
    }));
  } catch (_) { /* ignore */ }
}

// ─── Multi-Search Batch & UI State ─────────────────────────────────
export function updateBatchPanelUI() {
  const batchPanel = $('#batchPanel');
  const badge = $('#batchBadge');
  const pagesCount = $('#batchPagesCount');
  const tagsContainer = $('#batchSearchTags');
  const resultsCountPill = $('#resultsCountPill');
  const resultsSearchesPill = $('#resultsSearchesPill');

  const totalCases = AppState.currentCases.length;
  const totalSearches = AppState.searchBatches.length;

  if (totalCases > 0 || totalSearches > 0) {
    if (batchPanel) batchPanel.style.display = 'block';
    if (badge) badge.textContent = `${totalCases} Cases Accumulated`;
    if (pagesCount) {
      pagesCount.textContent = totalSearches > 0
        ? `(across ${totalSearches} search${totalSearches === 1 ? '' : 'es'})`
        : '';
    }

    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      AppState.searchBatches.forEach(b => {
        const tag = document.createElement('span');
        tag.className = 'batch-tag';
        tag.innerHTML = `🔍 ${escapeHtml(b.query)} <span class="batch-tag-count">${b.count}</span>`;
        tagsContainer.appendChild(tag);
      });
    }
  } else {
    if (batchPanel) batchPanel.style.display = 'none';
    if (tagsContainer) tagsContainer.innerHTML = '';
  }

  if (resultsCountPill) {
    resultsCountPill.textContent = `${totalCases} Cases`;
  }
  if (resultsSearchesPill) {
    resultsSearchesPill.textContent = totalSearches > 0
      ? `from ${totalSearches} search${totalSearches === 1 ? '' : 'es'}`
      : '';
  }
}

$('#btnClearScans')?.addEventListener('click', () => {
  if (AppState.currentCases.length > 0 && !confirm('Clear all accumulated cases and searches to start fresh?')) {
    return;
  }
  AppState.currentCases = [];
  AppState.currentReport = null;
  AppState.searchBatches = [];

  persistScanResults();

  updateBatchPanelUI();
  const rc = $('#resultsContent');
  if (rc) rc.style.display = 'none';
  const nr = $('#noResults');
  if (nr) nr.style.display = 'block';
  const rb = $('#resultsBadge');
  if (rb) rb.style.display = 'none';
  const db = $('#btnDeepScrape');
  if (db) db.disabled = true;
  updateChecklist();
  showToast('Accumulated cases cleared. You can start a fresh search.', 'info', 3500);
});

$('#btnScanAnotherPage')?.addEventListener('click', () => {
  switchTab('scan');
  showToast('💡 Upload another MyCase file or drag and drop to combine with existing records.', 'info', 5000);
  const target = $('#dropZone') || $('#btnSelectFiles') || $('#btnScan');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
});

// ─── Manual Case Entry ─────────────────────────────────────────────
$('#btnManualEntry')?.addEventListener('click', () => {
  $('#manualEntryForm').reset();
  $('#manualEntryModal').style.display = 'flex';
});

$('#btnManualCancel')?.addEventListener('click', () => {
  $('#manualEntryModal').style.display = 'none';
});

$('#btnManualSave')?.addEventListener('click', () => {
  const form = $('#manualEntryForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const caseNumber = $('#manualCaseNumber').value.trim().toUpperCase();
  const caseType = $('#manualCaseType').value.trim().toUpperCase();
  const filed = $('#manualDispositionDate').value;
  const title = $('#manualCaseTitle').value.trim();
  const charges = $('#manualCharges').value.trim();

  if (!caseNumber.includes('-')) {
    showToast('Case number must be in the format XXDXX-YYMM-CC-NNNNNN', 'error', 4000);
    return;
  }

  const countyCode = caseNumber.substring(0, 2);

  const newCase = {
    case_number: caseNumber,
    case_type: caseType,
    filed: filed,
    title: title,
    charges: charges,
    court: countyCode ? `County ${countyCode}` : 'Unknown Court',
    status: 'Decided',
    searchContext: 'Manual Entry',
    searchQueries: ['Manual Entry'],
    isManualEntry: true
  };

  AppState.currentCases.push(newCase);

  if (window.IndianaExpungement?.analyzeAll) {
    AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
  }

  persistScanResults();
  updateBatchPanelUI();
  renderResults();
  updateChecklist();

  $('#manualEntryModal').style.display = 'none';
  showToast(`Successfully added case ${caseNumber} manually.`, 'success', 4000);
});

function checkAndSuggestAlias(query) {
  if (!query || query === 'MyCase Search' || query.length < 3) return;
  const aliasesInput = $('#aliases');
  const currentAliases = (aliasesInput?.value || AppState.petitionerProfile?.aliases || '').trim();
  const fullName = ($('#fullName')?.value || AppState.petitionerProfile?.fullName || '').trim().toLowerCase();

  const cleanQuery = query.replace(/[^\w\s,'-]/g, '').trim();
  if (!cleanQuery) return;

  let naturalName = cleanQuery;
  if (cleanQuery.includes(',')) {
    const parts = cleanQuery.split(',').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      naturalName = `${parts[1]} ${parts[0]}`;
    }
  }

  const normNat = naturalName.toLowerCase();
  if (fullName && !fullName.includes(normNat) && !normNat.includes(fullName)) {
    if (!currentAliases.toLowerCase().includes(normNat)) {
      if (aliasesInput && !aliasesInput.value.trim()) {
        aliasesInput.value = naturalName;
        showToast(`💡 Suggested "${naturalName}" for Petitioner Aliases (IC § 35-38-9-8(b)(1))`, 'info', 5000);
      } else if (aliasesInput && !aliasesInput.value.includes(naturalName)) {
        aliasesInput.value = `${aliasesInput.value}, ${naturalName}`;
        showToast(`💡 Added "${naturalName}" to Petitioner Aliases`, 'info', 5000);
      }
    }
  }
}

// ─── Page Status Check ─────────────────────────────────────────────
export async function checkPageStatus() {
  const statusDot = $('#pageStatusIndicator .status-dot');
  const statusText = $('#pageStatusText');
  if (!statusDot || !statusText) return false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !isMyCaseUrl(tab.url)) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Navigate to mycase.in.gov to begin';
      return false;
    }

    let response = null;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageStatus' });
    } catch (e) {
      if (await ensureContentScript(tab.id)) {
        try {
          response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageStatus' });
        } catch (_) { }
      }
    }

    if (response?.isSearchResults) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'MyCase search results detected ✓';
      return true;
    } else if (response?.isCaseSummary) {
      statusDot.className = 'status-dot checking';
      statusText.textContent = 'On case summary page — go to search results';
      return false;
    } else if (response) {
      statusDot.className = 'status-dot checking';
      statusText.textContent = 'On MyCase — navigate to search results';
      return false;
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Content script not loaded — refresh the MyCase page';
      return false;
    }
  } catch (e) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Content script not loaded — refresh the MyCase page';
    return false;
  }
}

export async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'getPageStatus' });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['eligibility.js', 'content.js']
      });
      const maxAttempts = 15;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
          await chrome.tabs.sendMessage(tabId, { action: 'getPageStatus' });
          return true;
        } catch (_) { }
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

// ─── Scan Action ───────────────────────────────────────────────────
const scanBtn = $('#btnScan');
if (scanBtn) {
  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Scanning...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      if (!isMyCaseUrl(tab.url)) {
        throw new Error('Not on a MyCase page — navigate to https://public.courts.in.gov/mycase first');
      }

      const scriptReady = await ensureContentScript(tab.id);
      if (!scriptReady) {
        throw new Error('Could not load the content script — please refresh the MyCase page');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyzeEligibility' });

      if (response?.success) {
        const incomingCases = response.cases || [];
        const searchContext = response.searchContext || 'MyCase Search';
        const mergeMode = $('#chkMergeCases')?.checked ?? true;

        if (incomingCases.length === 0) {
          showToast('No case records found on this MyCase page.', 'warning', 4000);
          return;
        }

        showParityModal(incomingCases, searchContext, mergeMode);
        return;
      } else {
        throw new Error(response?.error || 'Scan failed');
      }
    } catch (e) {
      if (e.message?.includes('Receiving end does not exist')) {
        showToast('Content script not responding — refresh the MyCase page and try again', 'error', 6000);
      } else {
        showToast(e.message, 'error');
      }
    } finally {
      scanBtn.disabled = false;
      scanBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Scan Page & Check Eligibility
      `;
    }
  });
}

function cleanHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent.trim();
}

function cleanCharges(charges) {
  if (!charges) return '';
  let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

export const DEMO_CASES = [
  {
    index: 1,
    case_number: '49D01-1804-CM-014920',
    title: 'State of Indiana v. John Doe',
    court: 'Marion Superior Court, Criminal Division 1',
    case_type: 'CM - Criminal Misdemeanor',
    filed: '04/15/2018',
    status: '05/10/2018, Disposed - Conviction',
    dispositionDate: '05/10/2018',
    charges: 'Operating a Vehicle While Intoxicated - Class A Misdemeanor',
    parties: 'Doe, John (Defendant)',
    attorneys: 'Public Defender',
    searchContext: 'Demo Cases (Marion & Hamilton County)',
    _source: 'demo'
  },
  {
    index: 2,
    case_number: '29D03-1509-F6-007812',
    title: 'State of Indiana v. John Doe',
    court: 'Hamilton Superior Court 3',
    case_type: 'F6 - Level 6 Felony, Theft',
    filed: '09/01/2015',
    status: '11/20/2015, Disposed - Conviction',
    dispositionDate: '11/20/2015',
    charges: 'Theft - Prior Conviction (Level 6 Felony)',
    parties: 'Doe, John (Defendant)',
    attorneys: 'Private Counsel',
    searchContext: 'Demo Cases (Marion & Hamilton County)',
    _source: 'demo'
  }
];

export async function parseCaseData(text, filename = '') {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid file content.');
  }

  let incomingCases = [];
  let searchContext = filename ? `File: ${filename}` : 'MyCase Import';
  const trimmed = text.trim();
  const isJson = (filename && filename.toLowerCase().endsWith('.json')) || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      let rawList = [];
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && Array.isArray(parsed.cases)) {
        rawList = parsed.cases;
        searchContext = parsed.searchContext || searchContext;
      } else if (parsed && Array.isArray(parsed.currentCases)) {
        rawList = parsed.currentCases;
        searchContext = parsed.searchContext || searchContext;
      } else if (parsed && parsed.scan && Array.isArray(parsed.scan.cases)) {
        rawList = parsed.scan.cases;
        searchContext = parsed.scan.searchContext || searchContext;
      } else if (parsed && Array.isArray(parsed.Results)) {
        rawList = parsed.Results;
      } else if (parsed && parsed.ob && Array.isArray(parsed.ob.Results)) {
        rawList = parsed.ob.Results;
      } else if (parsed && (parsed.case_number || parsed.CaseNumber || parsed.caseNumber)) {
        rawList = [parsed];
      } else {
        throw new Error('JSON does not contain a recognized case list structure.');
      }

      incomingCases = rawList.map((c, idx) => {
        const caseNum = (c.case_number || c.CaseNumber || c.caseNumber || '').trim().toUpperCase();
        const status = c.status || c.CaseStatus || c.statusDate || '';
        let dispDate = c.dispositionDate || '';
        if (!dispDate && status) {
          const m = status.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (m) dispDate = m[1];
        }
        return {
          index: c.index || idx + 1,
          case_number: caseNum,
          title: cleanHtml(c.title || c.Style || c.caseTitle || c.style || ''),
          court: c.court || c.Court || '',
          case_type: c.case_type || c.CaseType || c.caseType || '',
          filed: c.filed || c.FileDate || c.fileDate || '',
          status: status,
          dispositionDate: dispDate,
          charges: cleanCharges(c.charges || c.Charges || ''),
          parties: c.parties || c.Parties || '',
          attorneys: c.attorneys || c.Attorneys || '',
          caseToken: c.caseToken || c.CaseToken || c.CaseID || '',
          ccs: c.ccs || null,
          financials: c.financials || null,
          searchContext: c.searchContext || searchContext,
          _source: c._source || 'json-upload'
        };
      }).filter(c => Boolean(c.case_number));
    } catch (jsonErr) {
      throw new Error('Invalid JSON format: ' + jsonErr.message, { cause: jsonErr });
    }
  } else {
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(text, 'text/html');

    if (!window.MyCaseScraper) {
      throw new Error('Scraper module not loaded.');
    }

    if (window.MyCaseScraper.isSearchResultsPage(parsedDoc)) {
      incomingCases = window.MyCaseScraper.scrapeSearchResults(parsedDoc);
      searchContext = window.MyCaseScraper.getSearchContext(parsedDoc) || searchContext;
    } else {
      const domCases = window.MyCaseScraper._tryScrapeDOM ? window.MyCaseScraper._tryScrapeDOM(parsedDoc) : [];
      if (domCases.length > 0) {
        incomingCases = domCases;
        searchContext = window.MyCaseScraper.getSearchContext(parsedDoc) || searchContext;
      } else {
        const causeMatches = text.match(/\b\d{2}[A-Z]\d{2}-\d{4}-[A-Z0-9]{2}-\d{6}\b/gi);
        if (causeMatches && causeMatches.length > 0) {
          const uniqueCauses = Array.from(new Set(causeMatches.map(m => m.toUpperCase())));
          incomingCases = uniqueCauses.map((cn, idx) => ({
            index: idx + 1,
            case_number: cn,
            title: 'Extracted Case ' + cn,
            court: '',
            case_type: cn.split('-')[2] || '',
            filed: '',
            status: 'Decided',
            dispositionDate: '',
            charges: 'Extracted from text',
            searchContext: searchContext,
            _source: 'text-fallback'
          }));
        } else {
          throw new Error('No MyCase search results or Indiana cause numbers found.');
        }
      }
    }
  }
  return { cases: incomingCases, searchContext };
}

export async function handleFiles(files) {
  if (!files || files.length === 0) return;

  const uploadStatus = $('#uploadStatus');
  const uploadStatusText = $('#uploadStatusText');
  const selectBtns = [$('#btnSelectFiles'), $('#btnUploadHtml')].filter(Boolean);

  selectBtns.forEach(btn => {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;"></span> Reading...';
  });

  if (uploadStatus) uploadStatus.style.display = 'flex';
  if (uploadStatusText) {
    uploadStatusText.textContent = files.length === 1
      ? `Reading ${files[0].name}...`
      : `Processing ${files.length} files...`;
  }

  let allIncomingCases = [];
  let combinedContexts = [];
  let parseErrors = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (uploadStatusText && files.length > 1) {
        uploadStatusText.textContent = `Reading file ${i + 1} of ${files.length}: ${file.name}...`;
      }
      try {
        const text = await file.text();
        const result = await parseCaseData(text, file.name);
        if (result.cases && result.cases.length > 0) {
          allIncomingCases.push(...result.cases);
          if (result.searchContext && !combinedContexts.includes(result.searchContext)) {
            combinedContexts.push(result.searchContext);
          }
        }
      } catch (fileErr) {
        parseErrors.push(`${file.name}: ${fileErr.message}`);
      }
    }

    if (allIncomingCases.length === 0) {
      if (parseErrors.length > 0) {
        showToast(parseErrors[0], 'error', 6000);
      } else {
        showToast('No case records found in the uploaded file(s).', 'warning', 4000);
      }
      return;
    }

    const existingKeySet = new Set();
    const uniqueIncoming = [];
    allIncomingCases.forEach(c => {
      const key = (c.case_number || '').trim().toUpperCase();
      if (key) {
        if (!existingKeySet.has(key)) {
          existingKeySet.add(key);
          uniqueIncoming.push(c);
        }
      } else {
        uniqueIncoming.push(c);
      }
    });

    const searchContext = combinedContexts.length > 0 ? combinedContexts.join(' · ') : 'MyCase Import';
    const mergeMode = $('#chkMergeCases')?.checked ?? true;

    showParityModal(uniqueIncoming, searchContext, mergeMode);

    if (parseErrors.length > 0) {
      showToast(`Imported ${uniqueIncoming.length} cases with warning: ${parseErrors.join('; ')}`, 'warning', 6000);
    }
  } catch (err) {
    showToast(err.message || 'Error processing uploaded files.', 'error', 6000);
  } finally {
    if (uploadStatus) uploadStatus.style.display = 'none';
    selectBtns.forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
    });
    const fileInputs = [$('#fileUpload'), $('#htmlUpload')].filter(Boolean);
    fileInputs.forEach(inp => { inp.value = ''; });
  }
}

const selectBtnsListeners = [$('#btnSelectFiles'), $('#btnUploadHtml')].filter(Boolean);
const fileInputsListeners = [$('#fileUpload'), $('#htmlUpload')].filter(Boolean);

selectBtnsListeners.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const primaryInput = fileInputsListeners[0];
    primaryInput?.click();
  });
});

fileInputsListeners.forEach(input => {
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
  });
});

const dropZone = $('#dropZone');
if (dropZone) {
  let dragCounter = 0;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (eventName === 'dragenter') dragCounter++;
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'dragend'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropZone.classList.remove('drag-active');
      }
    });
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropZone.classList.remove('drag-active');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, textarea, label')) return;
    const primaryInput = fileInputsListeners[0];
    primaryInput?.click();
  });
}

window.addEventListener('dragover', (e) => { e.preventDefault(); }, false);
window.addEventListener('drop', (e) => { e.preventDefault(); }, false);

const pasteToggle = $('#btnPasteToggle');
const pasteContainer = $('#pasteContainer');
const pasteInput = $('#pasteInput');
const btnProcessPaste = $('#btnProcessPaste');

if (pasteToggle && pasteContainer) {
  pasteToggle.addEventListener('click', () => {
    const isHidden = pasteContainer.style.display === 'none' || !pasteContainer.style.display;
    pasteContainer.style.display = isHidden ? 'block' : 'none';
    if (isHidden && pasteInput) {
      pasteInput.focus();
    }
  });
}

if (btnProcessPaste && pasteInput) {
  btnProcessPaste.addEventListener('click', async () => {
    const text = pasteInput.value.trim();
    if (!text) {
      showToast('Please paste HTML source or JSON text first.', 'warning', 3500);
      pasteInput.focus();
      return;
    }

    btnProcessPaste.disabled = true;
    btnProcessPaste.textContent = 'Processing...';

    try {
      const result = await parseCaseData(text, 'Pasted Content');
      if (!result.cases || result.cases.length === 0) {
        showToast('No case records found in the pasted content.', 'warning', 4000);
        return;
      }
      const mergeMode = $('#chkMergeCases')?.checked ?? true;
      showParityModal(result.cases, result.searchContext || 'Pasted MyCase Data', mergeMode);
    } catch (err) {
      showToast(err.message, 'error', 6000);
    } finally {
      btnProcessPaste.disabled = false;
      btnProcessPaste.textContent = 'Import Pasted Data';
    }
  });
}

const btnLoadDemo = $('#btnLoadDemo');
if (btnLoadDemo) {
  btnLoadDemo.addEventListener('click', () => {
    const mergeMode = $('#chkMergeCases')?.checked ?? true;
    showToast('Loaded demo cases across Marion & Hamilton counties.', 'info', 3000);
    showParityModal(DEMO_CASES.map(c => ({ ...c })), 'Demo Cases (Marion & Hamilton County)', mergeMode);
  });
}

$('#btnCopyAppBookmarklet')?.addEventListener('click', async () => {
  const code = "javascript:(function(){const s=document.createElement('script');s.src='https://cambrianminds.github.io/expunger/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})();";
  try {
    await navigator.clipboard.writeText(code);
    showToast('✓ Bookmarklet code copied to clipboard!', 'success', 3000);
  } catch (_) {
    showToast('Please drag the blue button to your bookmarks bar.', 'info', 3000);
  }
});

const deepScrapeBtn = $('#btnDeepScrape');
if (deepScrapeBtn) {
  deepScrapeBtn.addEventListener('click', async () => {
    deepScrapeBtn.disabled = true;

    const progress = $('#scanProgress');
    const progressFill = $('#progressFill');
    const progressText = $('#progressText');
    if (progress) progress.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Starting deep scrape...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      if (!isMyCaseUrl(tab.url)) {
        throw new Error('Not on a MyCase page — navigate to https://public.courts.in.gov/mycase first');
      }

      const scriptReady = await ensureContentScript(tab.id);
      if (!scriptReady) {
        throw new Error('Could not load the content script — please refresh the MyCase page');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'deepScrape' });

      if (response?.success) {
        AppState.currentCases = response.cases;
        AppState.currentReport = response.report;
        renderResults();
        showToast('Deep scrape complete — CCS details enriched', 'success');
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = 'Complete!';

        chrome.runtime.sendMessage({
          action: 'saveScanResults',
          cases: AppState.currentCases,
          report: AppState.currentReport,
          searchBatches: AppState.searchBatches
        });
      } else {
        throw new Error(response?.error || 'Deep scrape failed');
      }
    } catch (e) {
      if (e.message?.includes('Receiving end does not exist')) {
        showToast('Content script not responding — refresh the MyCase page and try again', 'error', 6000);
      } else {
        showToast(e.message, 'error');
      }
    } finally {
      deepScrapeBtn.disabled = false;
      setTimeout(() => { if (progress) progress.style.display = 'none'; }, 2000);
    }
  });
}

if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'deepScrapeProgress') {
      const pct = Math.round((request.current / request.total) * 100);
      const fill = $('#progressFill');
      const text = $('#progressText');
      if (fill) fill.style.width = `${pct}%`;
      if (text) text.textContent = `Fetching CCS ${request.current}/${request.total}: ${request.caseNum}`;
    }
  });
}

// ─── Render Results ────────────────────────────────────────────────
export function renderResults() {
  if (!AppState.currentReport) return;

  const noResults = $('#noResults');
  const resultsContent = $('#resultsContent');
  if (noResults) noResults.style.display = 'none';
  if (resultsContent) resultsContent.style.display = 'block';

  const s = AppState.currentReport.summary;
  const elEligible = $('#summaryEligible');
  const elIneligible = $('#summaryIneligible');
  const elExcluded = $('#summaryExcluded');
  const elFee = $('#summaryFee');

  if (elEligible) elEligible.textContent = s.eligible;
  if (elIneligible) elIneligible.textContent = s.ineligible;
  if (elExcluded) elExcluded.textContent = s.excluded;
  if (elFee) elFee.textContent = s.totalFilingFee ? `~$${s.totalFilingFee}` : '$0';

  const badge = $('#resultsBadge');
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.textContent = AppState.currentCases.length;
  }

  const resultsCountPill = $('#resultsCountPill');
  const resultsSearchesPill = $('#resultsSearchesPill');
  if (resultsCountPill) resultsCountPill.textContent = `${AppState.currentCases.length} Cases`;
  if (resultsSearchesPill) {
    const numSearches = AppState.searchBatches.length || 1;
    resultsSearchesPill.textContent = `from ${numSearches} search${numSearches === 1 ? '' : 'es'}`;
  }

  const breakdownEl = $('#statuteBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = '';
    for (const [statute, count] of Object.entries(s.byStatute || {})) {
      const tag = document.createElement('span');
      tag.className = 'statute-tag';
      tag.innerHTML = `${escapeHtml(statute)} <span class="statute-tag-count">${count}</span>`;
      breakdownEl.appendChild(tag);
    }
  }

  const countySelectCard = $('#countySelectCard');
  const countySelectDropdown = $('#selectCountyPacket');
  const counties = AppState.currentReport.counties ? Object.entries(AppState.currentReport.counties) : [];

  if (countySelectCard && countySelectDropdown) {
    if (counties.length > 1) {
      countySelectCard.style.display = 'block';
      countySelectDropdown.innerHTML = '';
      counties.forEach(([code, cData]) => {
        const eligCount = cData.cases.filter(c => c.eligibility?.eligible).length;
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${cData.courtName || ('County ' + code)} (${eligCount} eligible of ${cData.cases.length} cases)`;
        countySelectDropdown.appendChild(opt);
      });
    } else {
      countySelectCard.style.display = 'none';
    }
  }

  const listEl = $('#caseList');
  if (!listEl) return;
  listEl.innerHTML = '';

  // NEW: Surface the Cross-County Lifetime Forfeiture Warning
  const block = AppState.currentReport.crossCountyBlock;
  if (block && !block.isSafe) {
    const banner = document.createElement('div');
    banner.className = 'financial-warning-box cross-county-warning';
    banner.style = 'background:rgba(220,38,38,0.08); border-left:4px solid #dc2626; padding:12px; margin-bottom:16px; border-radius:4px;';
    banner.innerHTML = `
      <strong style="color:#dc2626; display:block; margin-bottom:6px;">⚠️ ${escapeHtml(block.reason)}</strong>
      <p style="margin:0; color:var(--text-primary); font-size:0.9rem; line-height:1.4;">${escapeHtml(block.message)}</p>
    `;
    listEl.appendChild(banner);
  }

  const allCases = [];
  for (const county of Object.values(AppState.currentReport.counties || {})) {
    for (const c of county.cases) {
      allCases.push(c);
    }
  }

  allCases.sort((a, b) => {
    const aElig = a.eligibility?.eligible ? 0 : 1;
    const bElig = b.eligibility?.eligible ? 0 : 1;
    if (aElig !== bElig) return aElig - bElig;
    return (a.case_number || '').localeCompare(b.case_number || '');
  });

  for (const c of allCases) {
    listEl.appendChild(createCaseCard(c));
  }
}

function excludeCase(caseNum) {
  if (!caseNum) return;
  const idx = AppState.currentCases.findIndex(c => (c.case_number || '').trim().toUpperCase() === caseNum.trim().toUpperCase());
  if (idx === -1) return;

  AppState.currentCases.splice(idx, 1);

  if (window.IndianaExpungement?.analyzeAll) {
    AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
  }

  persistScanResults();

  updateBatchPanelUI();
  renderResults();
  updateChecklist();
  showToast(`Excluded ${caseNum} from filing. Eligibility recalculated.`, 'info', 3500);
}

function createCaseCard(caseData) {
  const el = caseData.eligibility;
  const card = document.createElement('div');
  card.className = 'case-card';

  let badgeClass = 'excluded';
  let badgeText = 'EXCLUDED';
  if (el) {
    if (el.eligible) {
      badgeClass = 'eligible';
      badgeText = 'ELIGIBLE';
    } else if (el.statute === 'N/A') {
      badgeClass = 'excluded';
      badgeText = 'CIVIL';
    } else if (el.isPending) {
      badgeClass = 'pending';
      badgeText = 'PENDING';
    } else {
      badgeClass = 'ineligible';
      badgeText = 'NOT ELIGIBLE';
    }
  }

  const chargesDisplay = caseData.charges || caseData.case_type || 'No charges listed';
  const typeCode = el?.typeCode || '';
  const searchQueriesDisplay = caseData.searchQueries?.length
    ? caseData.searchQueries.join(' · ')
    : (caseData.searchContext || '');

  card.innerHTML = `
    <div class="case-card-header">
      <span class="case-number">${escapeHtml(caseData.case_number || '')}</span>
      <div class="case-card-header-actions">
        <span class="case-badge ${badgeClass}">${badgeText}</span>
        <button type="button" class="btn-remove-case" title="Exclude this case from petition (e.g. maiden name mismatch / not you)">&times; Exclude</button>
      </div>
    </div>
    ${searchQueriesDisplay ? `<div class="case-search-tag">🔍 Found via: ${escapeHtml(searchQueriesDisplay)}</div>` : ''}
    <div class="case-charges">${escapeHtml(chargesDisplay)}</div>
    <div class="case-meta">
      <span>${escapeHtml(typeCode)}</span>
      <span>Filed: ${escapeHtml(caseData.filed || 'N/A')}</span>
      <span>${escapeHtml(caseData.court || '')}</span>
    </div>
    <div class="case-detail">
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">${escapeHtml(caseData.status || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Statute</span>
        <span class="detail-value statute">${escapeHtml(el?.statute || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Years Elapsed</span>
        <span class="detail-value">${el?.yearsElapsed ?? 'N/A'} years</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Waiting Period</span>
        <span class="detail-value">${el?.waitingPeriod ? `≥${el.waitingPeriod} years` : 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Grant Type</span>
        <span class="detail-value">${escapeHtml(el?.grantType || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reason</span>
        <span class="detail-value">${escapeHtml(el?.reason || '')}</span>
      </div>
      ${el?.exclusionReason ? `
        <div class="ineligible-mitigation-box ${el.mitigationType === 'consent_required' ? 'consent-required' : 'strictly-excluded'}">
          <div class="mitigation-title">Statutory Exclusion (IC § 35-38-9)</div>
          <p><strong>Rule:</strong> ${escapeHtml(el.exclusionReason)}</p>
          <p><strong>Mitigation:</strong> ${escapeHtml(el.mitigationSteps)}</p>
        </div>
      ` : ''}
      ${el?.warnings?.length ? `
        <div class="case-warnings">
          ${el.warnings.map(w => `<span class="warning-tag">⚠ ${escapeHtml(w)}</span>`).join('')}
        </div>
      ` : ''}
      ${(caseData.financials?.balanceDue > 0 || caseData.ccs?.financials?.balanceDue > 0) ? `
        <div class="financial-warning-box" style="background:rgba(220,38,38,0.08); border-left:3px solid #dc2626; padding:8px 12px; margin-top:8px; border-radius:4px; font-size:0.75rem;">
          <strong style="color:#dc2626;">⚠️ UNPAID COURT BALANCE: $${(caseData.financials?.balanceDue || caseData.ccs?.financials?.balanceDue || 0).toFixed(2)}</strong>
          <p style="margin:2px 0 0 0; color:var(--text-secondary);">Under Indiana Code § 35-38-9, all fines, fees, and restitution must be paid in full before an expungement petition can be granted.</p>
        </div>
      ` : ''}
      ${((caseData.financials?.restitutionOrdered && !caseData.financials?.restitutionSatisfied) || (caseData.ccs?.financials?.restitutionOrdered && !caseData.ccs?.financials?.restitutionSatisfied)) ? `
        <div class="financial-warning-box" style="background:rgba(217,119,6,0.08); border-left:3px solid #d97706; padding:8px 12px; margin-top:8px; border-radius:4px; font-size:0.75rem;">
          <strong style="color:#d97706;">⚠️ RESTITUTION ORDER DETECTED</strong>
          <p style="margin:2px 0 0 0; color:var(--text-secondary);">Verify that a formal Satisfaction of Restitution or clerk payment receipt is on file prior to filing.</p>
        </div>
      ` : ''}
    </div>
  `;

  card.addEventListener('click', () => card.classList.toggle('expanded'));
  card.querySelector('.btn-remove-case')?.addEventListener('click', (e) => {
    e.stopPropagation();
    excludeCase(caseData.case_number);
  });

  return card;
}