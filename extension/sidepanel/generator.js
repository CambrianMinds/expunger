import { AppState } from './state.js';
import { $, safeISOString } from './utils.js';
import { showToast, updateChecklist, switchTab } from './ui.js';
import { generateCompletePacket, generateAppearanceForm } from './pdf-generator.js';
import { getCountyInfo, STATEWIDE_AGENCIES, getAvailableCounties } from './county-directory.js';



  // ─── Engine Health & Readiness ──────────────────────────────────────
  export async function checkBackend(showFeedback = false) {
    const statusEl = $('#backendStatus');
    if (!statusEl) return true;
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('.status-label');

    AppState.backendOnline = true;
    if (dot) dot.className = 'status-dot online';
    if (label) label.textContent = 'Engine Ready';
    statusEl.title = 'In-Browser PDF Generator is active and ready (pdf-lib)';

    updateChecklist();

    if (showFeedback) {
      showToast('✓ In-Browser PDF Engine is active and ready', 'success', 3000);
    }

    return true;
  }


  export async function downloadPetition(blob, filename) {
    if (!chrome.downloads?.download) {
      throw new Error('Chrome downloads permission is unavailable.');
    }

    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url,
        filename,
        saveAs: true
      }, (downloadId) => {
        URL.revokeObjectURL(url);

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(downloadId);
      });
    });
  }

  // Click on backend status pill to manually refresh / retry
  $('#backendStatus')?.addEventListener('click', () => {
    checkBackend(true);
  });
  $('#backendStatus')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      checkBackend(true);
    }
  });


  // ─── Generate Packet ───────────────────────────────────────────────

  // ─── Legal Notice & Confirmation Modals ────────────────────────────
  const legalModal = $('#legalNoticeModal');
  const confirmModal = $('#confirmModal');

  $('#btnLegalNotice')?.addEventListener('click', () => {
    if (legalModal) legalModal.style.display = 'flex';
  });

  $('#btnNoticeClose')?.addEventListener('click', () => {
    if (legalModal) legalModal.style.display = 'none';
  });

  $('#btnModalCancel')?.addEventListener('click', () => {
    if (confirmModal) confirmModal.style.display = 'none';
  });

  $('#btnModalConfirm')?.addEventListener('click', async () => {
    if (confirmModal) confirmModal.style.display = 'none';
    await executePacketGeneration();
  });

  // Acknowledgment Checkbox Listeners
  ['ackOneShot', 'ackAllCounties', 'ackNotLawyer', 'ackProSe'].forEach(id => {
    $(`#${id}`)?.addEventListener('change', () => {
      updateChecklist();
    });
  });

  // Prior Filings Radio Listeners
  document.querySelectorAll('input[name="hasPriorFiling"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const box = $('#priorFilingDateBox');
      if (box) {
        box.style.display = e.target.value === 'yes' ? 'block' : 'none';
      }
    });
  });


  // ─── Generate Packet Trigger ───────────────────────────────────────
  $('#btnGenerate').addEventListener('click', () => {
    if (!AppState.petitionerProfile?.fullName) {
      showToast('Please fill in the Petitioner Profile first', 'error');
      switchTab('profile');
      return;
    }
    if (!AppState.currentReport || AppState.currentReport.summary.eligible === 0) {
      showToast('No eligible cases found. Scan a MyCase page first.', 'error');
      switchTab('scan');
      return;
    }
    
    if (AppState.currentReport.crossCountyBlock) {
      showToast('Cannot generate: Multi-county petitions must be filed within 365 days of each other (IC § 35-38-9-9(d)). Adjust dates or exclude cases.', 'error', 6000);
      return;
    }

    // Prior Filings 365-Day Enforcement
    const priorFilingYes = document.querySelector('input[name="hasPriorFiling"]:checked')?.value === 'yes';
    if (priorFilingYes) {
      const priorDateStr = $('#priorFilingDate')?.value;
      if (!priorDateStr) {
        showToast('Please enter the date of your prior county expungement filing.', 'error');
        return;
      }
      const priorDate = new Date(priorDateStr);
      const today = new Date();
      const diffTime = today.getTime() - priorDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays < 0) {
        showToast('Prior filing date cannot be in the future.', 'error');
        return;
      }
      
      if (diffDays > 365) {
        showToast('Cannot generate: Your 365-day window to file in multiple counties has expired (IC § 35-38-9-9(d)).', 'error', 7000);
        return;
      }
      
      // Calculate remaining days for warning
      const daysRemaining = 365 - diffDays;
      if (!confirm(`WARNING: You have exactly ${daysRemaining} days remaining to file this packet with the clerk to comply with the 365-day rule. Proceed?`)) {
        return;
      }
    }

    const acksReady = $('#ackOneShot')?.checked &&
                      $('#ackAllCounties')?.checked &&
                      $('#ackNotLawyer')?.checked &&
                      $('#ackProSe')?.checked;

    if (!acksReady) {
      showToast('You must acknowledge all mandatory legal notices and the one-shot rule before generating.', 'error', 5000);
      return;
    }

    // Populate the case list in the confirm modal so the user sees exactly what will be filed
    const caseListEl = $('#confirmCaseList');
    const caseCountEl = $('#confirmCaseCount');
    if (caseListEl && caseCountEl && AppState.currentCases.length > 0) {
      caseCountEl.textContent = AppState.currentCases.length;
      caseListEl.innerHTML = AppState.currentCases.map(c => {
        const num = c.case_number || 'UNKNOWN';
        const type = c.case_type || c.type || '';
        return `<div class="modal-case-item">
          <span class="modal-case-num">${num}</span>
          <span class="modal-case-type">${type}</span>
        </div>`;
      }).join('');
    }

    // Display the final confirmation modal to prevent accidental filing
    if (confirmModal) {
      confirmModal.style.display = 'flex';
    } else {
      executePacketGeneration();
    }
  });


  // ─── Execute Packet Generation (Backend Call) ──────────────────────
  async function executePacketGeneration() {
    const btn = $('#btnGenerate');
    const statusEl = $('#generateStatus');
    const statusText = $('#generateStatusText');

    btn.disabled = true;
    statusEl.style.display = 'flex';
    statusText.textContent = 'Preparing verified payload...';

    try {
      if (!AppState.petitionerProfile?.fullName) {
        throw new Error('Please fill in the Petitioner Profile first');
      }
      if (!AppState.currentReport || AppState.currentReport.summary.eligible === 0) {
        throw new Error('No eligible cases found. Scan a MyCase page first.');
      }
      
      if (AppState.currentReport.crossCountyBlock) {
        throw new Error('Cannot generate: Multi-county petitions must be filed within 365 days of each other (IC § 35-38-9-9(d)).');
      }

      // Re-verify the prior filings check to ensure safety in executePacketGeneration
      const priorFilingYesEx = document.querySelector('input[name="hasPriorFiling"]:checked')?.value === 'yes';
      if (priorFilingYesEx) {
        const priorDateStr = $('#priorFilingDate')?.value;
        if (!priorDateStr) throw new Error('Please enter the date of your prior county expungement filing.');
        const priorDate = new Date(priorDateStr);
        const diffDays = Math.floor((new Date().getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24)); 
        if (diffDays > 365) {
          throw new Error('Cannot generate: Your 365-day window to file in multiple counties has expired (IC § 35-38-9-9(d)).');
        }
      }

      // Determine target county (supports multi-county filing selection)
      const countySelectCard = $('#countySelectCard');
      const countySelectDropdown = $('#selectCountyPacket');
      const selectedCountyCode = (countySelectCard?.style.display !== 'none' && countySelectDropdown?.value)
        ? countySelectDropdown.value
        : null;

      let targetCounty = null;
      if (selectedCountyCode && AppState.currentReport.counties[selectedCountyCode]) {
        targetCounty = AppState.currentReport.counties[selectedCountyCode];
      } else {
        targetCounty = Object.values(AppState.currentReport.counties)[0];
      }

      // Build payload for the backend (filtered to targetCounty if multi-county)
      const eligibleCases = [];
      const casesToInclude = targetCounty ? targetCounty.cases : AppState.currentCases;

      for (const c of casesToInclude) {
        if (c.eligibility?.eligible) {
          eligibleCases.push({
            caseNumber: c.case_number,
            type: c.eligibility.typeCode,
            statute: c.eligibility.statute,
            charges: c.charges || c.case_type,
            filed: c.filed,
            dispositionDate: safeISOString(c.eligibility.dispositionDate)?.split('T')[0] || c.filed,
            court: c.court,
            grantType: c.eligibility.grantType
          });
        }
      }

      if (eligibleCases.length === 0) {
        throw new Error(`No eligible cases in ${targetCounty?.courtName || 'the selected county'}.`);
      }

      const payload = {
        petitioner: AppState.petitionerProfile,
        county: targetCounty?.courtName?.replace(/\s*(Superior|Circuit|Court)\s*/gi, '').trim() || 'Unknown',
        court: targetCounty?.courtName || 'Unknown Court',
        courtCode: targetCounty?.courtCode || 'XXXXX',
        cases: eligibleCases,
        includeFeeWaiver: $('#includeFeeWaiver')?.checked ?? true,
        includeAddressSupplement: $('#includeAddressSupplement')?.checked ?? true,
        eSignDocuments: $('#eSignDocuments')?.checked ?? false,
        acknowledgedOneShot: $('#ackOneShot')?.checked ?? true,
        acknowledgedNotLawyer: $('#ackNotLawyer')?.checked ?? true,
        acknowledgedAllCases: $('#ackAllCounties')?.checked ?? true,
        acknowledgedProSeLiability: $('#ackProSe')?.checked ?? true
      };

      statusText.textContent = 'Generating complete expungement packet (Forms 00–08)...';

      const pdfBytes = await generateCompletePacket(payload);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const countyName = (payload.county || 'expungement').replace(/\s+/g, '_');
      const petitionerLast = (payload.petitioner?.fullName || 'packet').split(/\s+/).pop();
      const filename = `${petitionerLast}_${countyName}_Expungement_Packet.pdf`;

      await downloadPetition(blob, filename);
      showToast(`Complete court packet generated: ${filename}`, 'success', 6000);
      statusText.textContent = `✓ Download started: ${filename}`;
    } catch (e) {
      showToast(e.message, 'error');
      statusText.textContent = `✗ ${e.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
    }
  }

  // ─── Filing & Service Address Directory ───────────────────────────
  export function renderServiceDirectory(countyName) {
    const container = $('#serviceDirBody');
    if (!container) return;

    const countyInfo = getCountyInfo(countyName);
    const isp = STATEWIDE_AGENCIES.isp;
    const bmv = STATEWIDE_AGENCIES.bmv;

    const agencies = [
      {
        title: countyInfo.clerk.title,
        badge: 'Filing Court',
        badgeClass: 'clerk',
        addr: `${countyInfo.clerk.address}, ${countyInfo.clerk.city}, ${countyInfo.clerk.state} ${countyInfo.clerk.zip}`,
        phone: countyInfo.clerk.phone,
        method: 'File original verified petition in person or via Odyssey E-Filing'
      },
      {
        title: countyInfo.prosecutor.title,
        badge: 'Service Party',
        badgeClass: '',
        addr: `${countyInfo.prosecutor.address}, ${countyInfo.prosecutor.city}, ${countyInfo.prosecutor.state} ${countyInfo.prosecutor.zip}`,
        phone: countyInfo.prosecutor.phone,
        method: countyInfo.prosecutor.serviceNotes || 'Certified U.S. Mail or IEFS e-service'
      },
      {
        title: isp.name,
        badge: 'Statutory Repository',
        badgeClass: '',
        addr: `${isp.address}, ${isp.city}, ${isp.state} ${isp.zip}`,
        phone: isp.phone,
        method: isp.serviceMethod
      },
      {
        title: bmv.name,
        badge: 'State Agency',
        badgeClass: '',
        addr: `${bmv.address}, ${bmv.city}, ${bmv.state} ${bmv.zip}`,
        phone: bmv.phone,
        method: bmv.serviceMethod
      },
      {
        title: countyInfo.sheriff.title,
        badge: 'Law Enforcement',
        badgeClass: '',
        addr: `${countyInfo.sheriff.address}, ${countyInfo.sheriff.city}, ${countyInfo.sheriff.state} ${countyInfo.sheriff.zip}`,
        phone: countyInfo.sheriff.phone,
        method: 'Certified U.S. Mail or Hand Delivery'
      }
    ];

    container.innerHTML = agencies.map((a, idx) => `
      <div class="service-agency-item">
        <div class="service-agency-header">
          <span class="service-agency-title">${a.title}</span>
          <span class="service-agency-badge ${a.badgeClass}">${a.badge}</span>
        </div>
        <div class="service-agency-addr">${a.addr}</div>
        <div class="service-agency-meta">
          <span>📞 ${a.phone} · <em>${a.method}</em></span>
          <button type="button" class="btn-copy-addr" data-copy-idx="${idx}" title="Copy statutory service address to clipboard">
            📋 Copy
          </button>
        </div>
      </div>
    `).join('');

    // Attach clipboard copy listeners
    container.querySelectorAll('.btn-copy-addr').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.copyIdx, 10);
        const target = agencies[idx];
        if (!target) return;
        const copyText = `${target.title}\n${target.addr}`;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(copyText).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '✓ Copied!';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#059669';
            setTimeout(() => {
              btn.innerHTML = orig;
              btn.style.borderColor = '';
              btn.style.color = '';
            }, 2000);
            showToast(`Copied address for ${target.title}`, 'info', 2000);
          }).catch(() => {
            showToast('Unable to copy address to clipboard', 'error');
          });
        }
      });
    });
  }

  export function syncDirectoryCounty(countyName) {
    const select = $('#selectDirectoryCounty');
    if (!select || !countyName) return;

    const target = countyName.trim().replace(/\s+(County|Superior|Circuit).*$/i, '').trim();
    // Look for matching option
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value.toLowerCase() === target.toLowerCase()) {
        select.selectedIndex = i;
        renderServiceDirectory(select.options[i].value);
        return;
      }
    }
  }

  export function initServiceDirectory() {
    const select = $('#selectDirectoryCounty');
    if (!select) return;

    const counties = getAvailableCounties();
    select.innerHTML = counties.map(c => `<option value="${c}">${c} County</option>`).join('');

    select.addEventListener('change', () => {
      renderServiceDirectory(select.value);
    });

    const initial = counties[0] || 'Marion';
    select.value = initial;
    renderServiceDirectory(initial);

    // Auto-sync when multi-county dropdown changes
    $('#selectCountyPacket')?.addEventListener('change', (e) => {
      const selectedCode = e.target.value;
      if (selectedCode && AppState.currentReport?.counties?.[selectedCode]) {
        const courtName = AppState.currentReport.counties[selectedCode].courtName;
        syncDirectoryCounty(courtName);
      }
    });

    // Auto-sync when Generate tab is opened
    document.querySelector('.tab-btn[data-tab="generate"]')?.addEventListener('click', () => {
      if (AppState.currentReport?.counties) {
        const selectedCode = $('#selectCountyPacket')?.value;
        const targetCounty = (selectedCode && AppState.currentReport.counties[selectedCode])
          ? AppState.currentReport.counties[selectedCode]
          : Object.values(AppState.currentReport.counties)[0];
        if (targetCounty?.courtName) {
          syncDirectoryCounty(targetCounty.courtName);
        }
      }
    });
  }

  // Initialize service directory
  initServiceDirectory();
