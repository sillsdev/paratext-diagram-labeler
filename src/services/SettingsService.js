// src/services/SettingsService.js
import { DEFAULT_PROJECTS_FOLDER } from '../demo.js';
import { templateSubfolder } from '../CollectionManager.js';
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
          lastProjectFolder: null,
          lastUsfm: null
        };
        
        // Save the default settings
        await this.saveSettings();
        console.log("Created default settings:", this.settings);
      }
        // Validate the Paratext Projects folder and templateSubfolder exists
      const folderExists = await this.folderExists(this.settings.paratextProjects + '/' + templateSubfolder);      
      if (!folderExists) {
        this.loadError = `Paratext projects folder containing _MapLabelerTemplates not found: ${this.settings.paratextProjects}`;
        console.warn(this.loadError);
        
        // Prompt user to select the Paratext projects folder, that must include the _MapLabelerTemplates subfolder.
        // If we don't get a valid folder, we must exit.
        alert("Please identify the location of the 'My Paratext Projects' folder.\n\nIt must contain a _MapLabelerTemplates subfolder containing the map template collection(s) you wish to use.");
        const selectedFolder = await window.electronAPI.selectProjectFolder();
        if (selectedFolder && await this.folderExists(selectedFolder + '/' + templateSubfolder)) {
          this.settings.paratextProjects = selectedFolder;
          await this.saveSettings();
          console.log("Updated Paratext projects folder:", this.settings.paratextProjects);
        } else {
          throw new Error("Invalid Paratext projects folder selected. Please ensure it contains the _MapLabelerTemplates subfolder.");
        }
      }
      
        // Validate the specific project folder exists
      const projFolderExists = await this.folderExists(this.settings.lastProjectFolder );      
      if (!projFolderExists) {
        this.loadError = `Paratext project folder not found: ${this.settings.lastProjectFolder}`;
        console.warn(this.loadError);
        
        // Prompt user to select the project folder.
        // If we don't get a valid folder, we must exit.
        alert("Please identify the location of the specific folder containing the project you wish to work with.");
        const selectedFolder = await window.electronAPI.selectProjectFolder();
        if (selectedFolder && await this.folderExists(selectedFolder )) {
          this.settings.lastProjectFolder = selectedFolder;
          await this.saveSettings();
          console.log("Updated lastProjectFolder:", this.settings.lastProjectFolder);
        } else {
          throw new Error("Invalid project folder selected.");
        }
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
  
  async updateLanguage(languageCode) {
    if (!this.settings) await this.loadSettings();
    this.settings.language = languageCode;
    return this.saveSettings();
  }
  
  getLanguage() {
    return this.settings?.language || 'en';
  }
}

// Create singleton instance
export const settingsService = new SettingsService();
