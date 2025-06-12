//import collPlacenamesAndRefs from './data/smr-PlaceNames&Refs.json';

class CollPlacenamesAndRefs {
    constructor() {
        this.data = {}; // Initialize with empty object
        this.isLoading = true; // Track loading state
        this.loadData(); // Start loading asynchronously
    }
    
    async loadData() {
        try {
            // Load data asynchronously 
            this.data = await window.electronAPI.loadFromJson('C:/My Paratext 9 Projects/_MapLabelerTemplates', 'smr-PlaceNames&Refs.json');
            this.isLoading = false;
            console.log('Place names data loaded successfully');
        } catch (error) {
            console.error('Failed to load place names data:', error);
            this.isLoading = false;
            this.data = {}; // Ensure data is an object even if loading fails
        }
    }
    
    getGloss(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.gloss;   
    }

    getTermId(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.termId;   
    }

    getDefinition(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
  //          console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.context;   
    }

    getTransliteration(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
//            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.transliteration;   
    }

    getRefs(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs!!`);
            return [];
        }
        return entry.refs || [];   
    }
}

const collPlacenames = new CollPlacenamesAndRefs();
export { collPlacenames };
export default CollPlacenamesAndRefs;