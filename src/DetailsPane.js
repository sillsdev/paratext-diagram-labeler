import React from 'react';

export default function DetailsPane({
  selLocation,
  onUpdateVernacular,
  onNextLocation,
  renderings,
  isApproved,
  onRenderingsChange,
  onApprovedChange,
  onSaveRenderings,
  termRenderings,
  locations,
  onSwitchView,
  onOk,
  mapPaneView,
  onSetView,
  onShowSettings,
  mapDef,
  onBrowseMapTemplate,
  vernacularInputRef // <-- receive ref from App
}) {
  return (
    <div>
      {/* ...existing code... */}
      <input
        // ...existing code...
        ref={vernacularInputRef}
        // ...existing code...
      />
      {/* ...existing code... */}
    </div>
  );
}