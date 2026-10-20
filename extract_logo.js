const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:/Users/emins/Downloads/osgb-tetkik-takip/global_data.json', 'utf8'));
const logo = data.settings?.companyLogo || '';
fs.mkdirSync('src/assets', { recursive: true });
fs.writeFileSync('src/assets/logoBase64.ts', `export const COMPANY_LOGO_BASE64 = "${logo}";`);
console.log('Logo extracted successfully.');
