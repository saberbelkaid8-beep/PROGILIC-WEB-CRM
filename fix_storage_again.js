import fs from 'fs';

let content = fs.readFileSync('src/business/storage.js', 'utf8');

const targetStr = `    } catch (err) {
      console.error(\`[Offline Sync] Failed to process action \${item.type}:\`, err);
      
      const isNetworkError`;

const replacementStr = `    } catch (err) {
      console.error(\`[Offline Sync] Failed to process action \${item.type}:\`, err);
      
      if (err.code === 'VERSION_CONFLICT' || (err.message && err.message.includes('VERSION_CONFLICT'))) {
        _isFlushing = false;
        errorOccurred = true;
        setSaveError(true);
        updateState({ 
          conflictItem: item, 
          conflictServerData: err.serverData,
          modal: 'conflict'
        });
        if (typeof window !== 'undefined' && window.R) window.R();
        break; 
      }
      
      const isNetworkError`;

content = content.replace(/    \} catch \(err\) \{\n      console\.error\(`\[Offline Sync\] Failed to process action \$\{item\.type\}:`, err\);\n\s*const isNetworkError/, replacementStr);

fs.writeFileSync('src/business/storage.js', content);
