// src/services/SettingsService.js
import { DEFAULT_PROJECTS_FOLDER } from '../demo.js';

class SettingsService {  constructor() {
    this.settings = null;
    this.isLoaded = false;
    this.loadError = null;
  }

  async loadSettings() {
    try {
      // Try to load settings file
      const settings = await window.electronAPI.loadFromJson(null, "MapLabelerSettings.json");
      
      // If settings were loaded successfully
      if (settings && Object.keys(settings).length > 0) {
        this.settings = settings;
        console.log("Settings loaded:", settings);
      } else {
        // Create default settings
        this.settings = {
          paratextProjects: DEFAULT_PROJECTS_FOLDER,
          language: "en",
          autoSave: true,
          recentProjects: [],
          lastProjectFolder: null,
          lastUsfm: null
        };
        
        // Save the default settings
        await this.saveSettings();
        console.log("Created default settings:", this.settings);
      }
        // Validate the Paratext Projects folder exists
      const folderExists = await this.folderExists(this.settings.paratextProjects);
      if (!folderExists) {
        this.loadError = `Paratext projects folder not found: ${this.settings.paratextProjects}`;
        console.warn(this.loadError);
        
        // Show alert to user
        alert(`${this.loadError}\n\nUsing default folder instead. You may need to update the Paratext Projects path in a future version.`);
        
        // Fall back to default folder
        this.settings.paratextProjects = DEFAULT_PROJECTS_FOLDER;
      }
      
      this.isLoaded = true;
      return this.settings;
    } catch (error) {
      this.loadError = `Failed to load settings: ${error.message}`;
      console.error(this.loadError, error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      await window.electronAPI.saveToJson(null, "MapLabelerSettings.json", this.settings);
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  }
  
  // Helper method to check if folder exists
  async folderExists(folderPath) {
    try {
      const stats = await window.electronAPI.statPath(folderPath);
      return stats && stats.isDirectory;
    } catch (error) {
      return false;
    }
  }

  getParatextProjectsFolder() {
    return this.settings?.paratextProjects || DEFAULT_PROJECTS_FOLDER;
  }

  async updateLastProjectFolder(folderPath) {
    if (!this.settings) await this.loadSettings();
    this.settings.lastProjectFolder = folderPath;
    return this.saveSettings();
  }

  async updateLastUsfm(usfmContent) {
    if (!this.settings) await this.loadSettings();
    this.settings.lastUsfm = usfmContent;
    return this.saveSettings();
  }

  getLastProjectFolder() {
    return this.settings?.lastProjectFolder || null;
  }

  getLastUsfm() {
    return this.settings?.lastUsfm || null;
  }
}

// Create singleton instance
export const settingsService = new SettingsService();
