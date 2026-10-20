const fs = require('fs');
let c = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
const replacement = `
export default function SettingsWithErrorBoundary() { 
  return <ErrorBoundary><Settings /></ErrorBoundary>; 
}
class ErrorBoundary extends React.Component<any, any> { 
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; } 
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; } 
  render() { 
    if (this.state.hasError) { 
      return <div style={{color:'red', padding:'20px'}}><h1>Error!</h1><pre>{this.state.error?.stack || this.state.error?.message}</pre></div>; 
    } 
    return this.props.children; 
  } 
}`;
c = c.replace('export default Settings;', replacement);
fs.writeFileSync('src/pages/Settings.tsx', c);
