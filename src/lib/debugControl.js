// Contrôle global du DebugLog via console
// Usage: window.debugControl.toggle() ou window.debugControl.isEnabled()

export const debugControl = {
  _enabled: true,  // ACTIVÉ par défaut pour voir les problèmes
  
  toggle() {
    this._enabled = !this._enabled;
    console.log(`🔧 Debug log ${this._enabled ? 'ENABLED' : 'DISABLED'}`);
    return this._enabled;
  },
  
  enable() {
    this._enabled = true;
    console.log('🔧 Debug log ENABLED');
  },
  
  disable() {
    this._enabled = false;
    console.log('🔧 Debug log DISABLED');
  },
  
  isEnabled() {
    return this._enabled;
  }
};

// Exposer en global
if (typeof window !== 'undefined') {
  window.debugControl = debugControl;
  console.log('🔧 Use: window.debugControl.toggle() or window.debugControl.enable()');
}