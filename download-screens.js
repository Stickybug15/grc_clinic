const https = require('https');
const fs = require('fs');
const path = require('path');

const screens = {
  'dashboard.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzg1MmQ0MjQzYzYxNjQ5N2M4MTRlYTllNzcwNWI5ODE4EgsSBxDbnqrbgwoYAZIBIwoKcHJvamVjdF9pZBIVQhM5MzY4MjM2OTQ0MzA2MzE0NTM0&filename=&opi=89354086',
  'patients.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzZhZDc5ZDQwMWM0OTQyNzJhZDBkMjhmY2UyNWRiOTBiEgsSBxDbnqrbgwoYAZIBIwoKcHJvamVjdF9pZBIVQhM5MzY4MjM2OTQ0MzA2MzE0NTM0&filename=&opi=89354086',
  'consultations.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2I2MjMxNDI2ZDgyZTQ1NGJiMjAxYTA4OThkNzcxODMwEgsSBxDbnqrbgwoYAZIBIwoKcHJvamVjdF9pZBIVQhM5MzY4MjM2OTQ0MzA2MzE0NTM0&filename=&opi=89354086',
  'medicines.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzE1YjAyNmU2N2VjZDQ0YWZiZGUxYTJlNGE1ZmVhZjUwEgsSBxDbnqrbgwoYAZIBIwoKcHJvamVjdF9pZBIVQhM5MzY4MjM2OTQ0MzA2MzE0NTM0&filename=&opi=89354086'
};

const frontendDir = path.join(__dirname, 'frontend');
if (!fs.existsSync(frontendDir)){
    fs.mkdirSync(frontendDir);
}

for (const [filename, url] of Object.entries(screens)) {
  const filePath = path.join(frontendDir, filename);
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      fs.writeFileSync(filePath, data);
      console.log(`Downloaded: ${filename}`);
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${filename}: `, err.message);
  });
}
