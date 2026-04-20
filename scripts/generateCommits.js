import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, 'public');

// Assicurati che la cartella public esista
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

try {
  // Esegui git log per i 10 ultimi commit con formato semplice
  // Format: date|subject|body
  const logsWithDetails = execSync('git log --format=%ai%n%s%n%b%n---END--- -10', {
    encoding: 'utf-8',
    cwd: projectRoot,
    shell: true
  }).trim();

  const commitStrings = logsWithDetails.split('---END---').filter(c => c.trim());
  
  const commits = commitStrings.slice(0, 10).map((commitBlock) => {
    const lines = commitBlock.trim().split('\n');
    const dateStr = lines[0];
    const subject = lines[1] || 'Aggiornamento';
    const body = lines.slice(2).join('\n').trim();

    const date = new Date(dateStr.split(' ')[0]);

    return {
      date: date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      title: subject,
      description: body || 'Modifica all\'app'
    };
  });

  // Salva in public/commits.json
  const outputPath = path.join(publicDir, 'commits.json');
  fs.writeFileSync(outputPath, JSON.stringify(commits, null, 2));

  console.log(`✅ Commit generati in ${outputPath}`);
} catch (error) {
  console.log('⚠️  Impossibile leggere i commit Git');
  // Crea un file con dati di default
  const defaultCommits = [
    {
      date: new Date().toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      title: 'App inizializzata',
      description: 'Prima versione dell\'app'
    }
  ];
  const outputPath = path.join(publicDir, 'commits.json');
  fs.writeFileSync(outputPath, JSON.stringify(defaultCommits, null, 2));
}
