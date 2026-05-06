const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'seeds');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('isApproved: true')) {
    content = content.replace(/isApproved:\s*true/g, "approvalStatus: 'approved'");
    changed = true;
  }
  if (content.includes('isApproved: false')) {
    content = content.replace(/isApproved:\s*false/g, "approvalStatus: 'pending'");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${file}`);
  }
});
