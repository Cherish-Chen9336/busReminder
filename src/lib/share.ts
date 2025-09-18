// Share functionality for stations and arrival times
export class ShareService {
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'navigator' in window && 'share' in navigator;
  }

  // Check if native sharing is supported
  isNativeShareSupported(): boolean {
    return this.isSupported;
  }

  // Share station information
  async shareStation(stationName: string, stationCode: string, departures: any[]): Promise<boolean> {
    const nextDeparture = departures[0];
    const shareText = `🚌 Bus Station: ${stationName} (${stationCode})\n\nNext buses:\n${departures.slice(0, 3).map(dep => 
      `• ${dep.route} to ${dep.headsign} - ${dep.etaMin} min`
    ).join('\n')}\n\nShared from Dubai Bus Buddy`;

    if (this.isSupported) {
      try {
        await navigator.share({
          title: `Bus Station: ${stationName}`,
          text: shareText,
          url: window.location.href
        });
        return true;
      } catch (error) {
        console.error('Error sharing:', error);
        return this.fallbackShare(shareText);
      }
    } else {
      return this.fallbackShare(shareText);
    }
  }

  // Share route information
  async shareRoute(routeId: string, routeName: string, realtimeBuses: any[]): Promise<boolean> {
    const shareText = `🚌 Route ${routeId}: ${routeName}\n\nReal-time buses: ${realtimeBuses.length}\n${realtimeBuses.map(bus => 
      `• ${bus.busId} - ${bus.currentStop} → ${bus.nextStop} (${Math.round(bus.progress)}% complete)`
    ).join('\n')}\n\nShared from Dubai Bus Buddy`;

    if (this.isSupported) {
      try {
        await navigator.share({
          title: `Route ${routeId}`,
          text: shareText,
          url: window.location.href
        });
        return true;
      } catch (error) {
        console.error('Error sharing:', error);
        return this.fallbackShare(shareText);
      }
    } else {
      return this.fallbackShare(shareText);
    }
  }

  // Share arrival time
  async shareArrivalTime(route: string, stopName: string, etaMinutes: number, scheduledTime: string): Promise<boolean> {
    const shareText = `🚌 Bus ${route} arriving at ${stopName}\n\n⏰ ETA: ${etaMinutes} minutes\n🕐 Scheduled: ${scheduledTime}\n\nShared from Dubai Bus Buddy`;

    if (this.isSupported) {
      try {
        await navigator.share({
          title: `Bus ${route} Arrival`,
          text: shareText,
          url: window.location.href
        });
        return true;
      } catch (error) {
        console.error('Error sharing:', error);
        return this.fallbackShare(shareText);
      }
    } else {
      return this.fallbackShare(shareText);
    }
  }

  // Fallback sharing method with modal
  private fallbackShare(text: string): boolean {
    try {
      // Create a modal for sharing
      this.showShareModal(text);
      return true;
    } catch (error) {
      console.error('Error showing share modal:', error);
      return false;
    }
  }

  // Show share modal
  private showShareModal(text: string): void {
    // Remove existing modal if any
    const existingModal = document.getElementById('share-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;

    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #2563eb; font-size: 18px;">📤 Share Information</h3>
        <button id="close-share-modal" style="
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">✕</button>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #374151;">Share Text:</label>
        <textarea id="share-text" readonly style="
          width: 100%;
          height: 120px;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          resize: vertical;
          background: #f9fafb;
        ">${text}</textarea>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="copy-share-text" style="
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">📋 Copy to Clipboard</button>
        <button id="close-share-modal-btn" style="
          background: #6b7280;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Add event listeners
    const closeModal = () => {
      modal.remove();
    };

    const copyText = () => {
      const textarea = document.getElementById('share-text') as HTMLTextAreaElement;
      textarea.select();
      document.execCommand('copy');
      
      // Show success message
      const copyBtn = document.getElementById('copy-share-text') as HTMLButtonElement;
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✅ Copied!';
      copyBtn.style.background = '#10b981';
      
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '#2563eb';
      }, 2000);
    };

    // Event listeners
    document.getElementById('close-share-modal')?.addEventListener('click', closeModal);
    document.getElementById('close-share-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('copy-share-text')?.addEventListener('click', copyText);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
}

// Create global instance
export const shareService = new ShareService();