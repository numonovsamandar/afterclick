/**
 * AfterClick Companion — Background service worker.
 * Handles context menus and message routing.
 */

const CONTEXT_MENU_ID = 'afterclick-analyze';

// Set up context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Analyze with AfterClick',
    contexts: ['selection'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    // Store selected text and open inspect page
    chrome.storage.session.set(
      { selectedText: info.selectionText, selectedFrom: tab?.url ?? '' },
      () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL('inspect.html'),
        });
      }
    );
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        sendResponse({
          url: tab.url ?? '',
          title: tab.title ?? '',
          tabId: tab.id,
        });
      } else {
        sendResponse({ url: '', title: '', tabId: undefined });
      }
    });
    return true; // async response
  }

  if (message.type === 'INJECT_CONTENT_SCRIPT') {
    const tabId = message.tabId as number;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No tab ID' });
      return true;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ['content/content-script.js'],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          // Now request content from the injected script
          chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: 'Could not communicate with page. It may be a restricted Chrome page.' });
            } else {
              sendResponse({ ok: true, data: response });
            }
          });
        }
      }
    );
    return true; // async response
  }

  if (message.type === 'OPEN_WEBSITE') {
    chrome.tabs.create({ url: message.url as string });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

export {};
