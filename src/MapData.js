const allMapData = require('./data/all-map-data.json');

function getMapData(mapId, mapBibTerms) {
    // Dynamically import the JSON file and return the requested map data
    try {
        const mapData = allMapData[mapId];
        if (!mapData) return null;
        if (Array.isArray(mapData.labels)) {
            mapData.labels = mapData.labels.map((label, idx) => ({ ...label, idx, gloss: mapBibTerms.getGloss(label.termId) }));
        }
        mapData.template = mapId;
        return { ...mapData };
    } catch (e) {
        console.error('Failed to load all-map-data.json:', e);
        return null;
    }
}

export { getMapData };
