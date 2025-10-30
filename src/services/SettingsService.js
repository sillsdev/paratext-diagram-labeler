// src/services/SettingsService.js

const PDL_SETTINGS_FILENAME = 'DiagramLabelerSettings.json';

class SettingsService {
  constructor() {
    this.settings = null;
    this.isLoaded = false;
    this.loadError = null;
  }

  async loadSettings() {
    // If settings are already loaded, return them without reloading
    if (this.isLoaded && this.settings) {
      return this.settings;
    }

    try {
      // Try to load settings file
      const settings = await window.electronAPI.loadFromJson(null, PDL_SETTINGS_FILENAME);

      // If settings were loaded successfully
      if (settings && Object.keys(settings).length > 0) {
        this.settings = settings;
        console.log('Settings loaded:', settings);
      } else {
        // Unable to load settings or file is empty
        this.settings = {
          language: 'en',
          projectFolder: null,
          usfm: null,
          templateFolder: null,
          saveToDemo: false,
        };
        await this.saveSettings(); // Save the default settings
        console.log('Created default settings:', this.settings);
      }
      this.isLoaded = true;
      return this.settings;
    } catch (error) {
      this.loadError = error.message || 'Failed to load settings';
      console.error('Error loading settings:', error);
      this.isLoaded = false;
      throw error;
    }
  }

  // Helper to check if a folder exists. Path has already been normalized.
  async folderExists(path) {
    if (!path) return false;

    try {
      console.log('Checking folder exists:', path);

      const stat = await window.electronAPI.statPath(path);
      // The stat object has isDirectory as a property, not a function
      return stat && stat.isDirectory === true;
    } catch (error) {
      console.error('Error checking folder exists:', error);
      return false;
    }
  }

  async saveSettings() {
    if (!this.settings) return false;

    try {
      await window.electronAPI.saveToJson(null, PDL_SETTINGS_FILENAME, this.settings);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  isSettingsLoaded() {
    return this.isLoaded;
  }

  getSettings() {
    return this.settings;
  }

  getProjectFolder() {
    return this.settings?.projectFolder || null;
  }
  // Enhanced getter for templateFolder with proper path normalization
  getTemplateFolder() {
    return this.settings?.templateFolder || null;
  }

  // Get language setting (defaults to 'en')
  getLanguage() {
    return this.settings?.language || 'en';
  }

  // Get language setting (defaults to 'en')
  getLanguageCode() {
    return this.settings?.languageCode || 'en';
  }

  // Get last USFM
  getUsfm() {
    return this.settings?.usfm || null;
  }

  async updateProjectFolder(folder) {
    if (this.settings) {
      this.settings.projectFolder = folder;
      await this.saveSettings();
      return true;
    }
    return false;
  }

  async updateLanguage(language) {
    console.log('Updating language to:', language);
    if (this.settings) {
      this.settings.language = language;
      await this.saveSettings();
      return true;
    }
    return false;
  }

  async updateSaveToDemo(saveToDemo) {
    console.log('Updating saveToDemo to:', saveToDemo);
    if (this.settings) {
      this.settings.saveToDemo = saveToDemo;
      await this.saveSettings();
      return true;
    }
    return false;
  }

  async updateUsfm(usfm) {
    if (this.settings) {
      this.settings.usfm = usfm;
      await this.saveSettings();
      return true;
    }
    return false;
  }
  // Enhanced setter for templateFolder with proper path normalization
  async updateTemplateFolder(folder) {
    if (!this.settings) return false;

    try {
      if (folder) {
        // Normalize path to ensure consistent slashes for current platform
        // Use forward slashes for consistency across platforms, Node.js handles this
        const normalizedFolder = folder.replace(/\\/g, '/');
        console.log('Setting template folder to:', normalizedFolder);

        // Check if folder exists before saving it
        const exists = await this.folderExists(normalizedFolder);
        if (exists) {
          this.settings.templateFolder = normalizedFolder;
          await this.saveSettings();
          console.log('Template folder updated and saved:', normalizedFolder);
          return true;
        } else {
          console.error('Cannot update template folder - folder not found:', normalizedFolder);
          throw new Error(`Template folder not found: ${normalizedFolder}`);
        }
      } else {
        // If null/empty, reset to default
        this.settings.templateFolder = null;
        await this.saveSettings();
        console.log('Template folder reset to default');
        return true;
      }
    } catch (error) {
      console.error('Error updating template folder:', error);
      return false;
    }
  }

  async updateSettings(newSettings) {
    if (!newSettings) return false;

    // Update the internal settings
    this.settings = { ...newSettings };

    // Save to disk
    return await this.saveSettings();
  }
}

// Create singleton instance
export const settingsService = new SettingsService();
