// filepath: c:\git\mapLabelerExt\biblical-map-app\src\services\SettingsService.js
// src/services/SettingsService.js
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
        this.settings = {
          language: "en",
          projectFolder: null,
          usfm: null,
          templateFolder: null
        };
        
        // Save the default settings
        await this.saveSettings();
        console.log("Created default settings:", this.settings);
      }        // Validate the template folder exists
      const templatePath = this.getTemplateFolder(); // Use the getter for proper path construction
      const folderExists = await this.folderExists(templatePath);
      
      if (!folderExists) {
        this.loadError = `Template folder not found: ${templatePath}`;
        console.warn(this.loadError);
        
        // Prompt user to select the template folder
        alert("Please identify the location of the templates folder.\n\nThis folder should contain the map template collection(s) you wish to use.");
        const selectedFolder = await window.electronAPI.selectProjectFolder();
        if (selectedFolder && await this.folderExists(selectedFolder)) {
          this.settings.templateFolder = selectedFolder;
          await this.saveSettings();
          console.log("Updated template folder:", this.settings.templateFolder);
        } else {
          throw new Error("Invalid template folder selected.");
        }
      }
      
        // Validate the specific project folder exists
      if (this.settings.projectFolder) {
        const projectExists = await this.folderExists(this.settings.projectFolder);
        if (!projectExists) {
          console.warn(`project folder not found: ${this.settings.projectFolder}`);
          this.settings.projectFolder = null;
          await this.saveSettings();
        }
      }
      
      this.isLoaded = true;
      return this.settings;
    } catch (error) {
      this.loadError = error.message || "Failed to load settings";
      console.error("Error loading settings:", error);
      this.isLoaded = false;
      throw error;
    }  }
  
  // Helper to check if a folder exists
  async folderExists(path) {
    if (!path) return false;
    
    try {
      // Normalize path by replacing forward slashes with backslashes for Windows
      const normalizedPath = path.replace(/\//g, '\\');
      console.log('Checking folder exists:', normalizedPath);
      
      const stat = await window.electronAPI.statPath(normalizedPath);
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
      await window.electronAPI.saveToJson(null, "MapLabelerSettings.json", this.settings);
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  }

  isSettingsLoaded() {
    return this.isLoaded;
  }

  getSettings() {
    return this.settings;
  }

  getLastProjectFolder() {
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
    if (this.settings) {
      this.settings.language = language;
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
        // Normalize path to ensure consistent Windows backslashes
        const normalizedFolder = folder.replace(/\//g, '\\');
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
}

// Create singleton instance
export const settingsService = new SettingsService();
