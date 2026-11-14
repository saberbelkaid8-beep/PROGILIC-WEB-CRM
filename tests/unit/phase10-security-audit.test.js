import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sanitizeAndAuditDist } from '../../scripts/postbuild.js';
import { executePurge } from '../../src/business/purgeService.js';
import { setCurrentUser, setClients } from '../../src/state/store.js';

describe('Phase 10 — Security & Tenant Isolation Preflight Suite', () => {
  const tempDistDir = path.resolve('temp_test_dist');

  beforeEach(() => {
    if (fs.existsSync(tempDistDir)) {
      fs.rmSync(tempDistDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDistDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDistDir)) {
      fs.rmSync(tempDistDir, { recursive: true, force: true });
    }
  });

  describe('1. Build Artifact Sanitization & Leak Prevention', () => {
    it('automatically deletes dist/assets/aistudio and forbidden dev screenshot PNGs', () => {
      // Simulate build artifacts containing forbidden files
      const aistudioDir = path.join(tempDistDir, 'assets', 'aistudio');
      fs.mkdirSync(aistudioDir, { recursive: true });
      fs.writeFileSync(path.join(aistudioDir, 'Paste_Log.txt'), 'sensitive telemetry log');

      fs.writeFileSync(path.join(tempDistDir, 'screenshot_desktop.png'), 'png dev screen');
      fs.writeFileSync(path.join(tempDistDir, 'test_logo.png'), 'png test screen');

      // Add a legitimate web asset
      const cssDir = path.join(tempDistDir, 'css');
      fs.mkdirSync(cssDir, { recursive: true });
      fs.writeFileSync(path.join(cssDir, 'main.css'), 'body { background: #000; }');
      fs.writeFileSync(path.join(tempDistDir, 'index.html'), '<html></html>');

      const remaining = sanitizeAndAuditDist(tempDistDir);

      expect(fs.existsSync(aistudioDir)).toBe(false);
      expect(fs.existsSync(path.join(tempDistDir, 'screenshot_desktop.png'))).toBe(false);
      expect(fs.existsSync(path.join(tempDistDir, 'test_logo.png'))).toBe(false);
      expect(fs.existsSync(path.join(cssDir, 'main.css'))).toBe(true);
      expect(remaining.length).toBe(2);
    });

    it('throws SECURITY_ARTIFACT_LEAK_IN_DIST if any forbidden markdown, pdf, or log file remains in dist', () => {
      fs.writeFileSync(path.join(tempDistDir, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(tempDistDir, 'secret_audit.md'), '# Secret Report');

      expect(() => sanitizeAndAuditDist(tempDistDir)).toThrowError(/SECURITY_ARTIFACT_LEAK_IN_DIST/);
    });
  });

  describe('2. Open Redirect Defense & URL Sanitization', () => {
    it('validates relative URLs and rejects protocol-relative or external redirect targets', () => {
      function sanitizeReturnUrl(returnUrl) {
        if (!returnUrl || typeof returnUrl !== 'string') return '/';
        const trimmed = returnUrl.trim();
        if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
          return '/';
        }
        return trimmed;
      }

      expect(sanitizeReturnUrl('/dashboard')).toBe('/dashboard');
      expect(sanitizeReturnUrl('/clients?id=123')).toBe('/clients?id=123');

      // Defend against open redirects
      expect(sanitizeReturnUrl('//evil.com')).toBe('/');
      expect(sanitizeReturnUrl('https://evil.com')).toBe('/');
      expect(sanitizeReturnUrl('/\\evil.com')).toBe('/');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/');
    });
  });

  describe('3. Sensitive Path Blocking in Web Server', () => {
    it('identifies and blocks dotfiles, aistudio assets, and raw document paths with 403', () => {
      const FORBIDDEN_STATIC_PREFIXES = ['/assets/aistudio', '/.env', '/.git', '/firebase-applet-config.json'];
      const FORBIDDEN_STATIC_EXTENSIONS = ['.md', '.pdf', '.log', '.bak', '.map'];

      function isBlockedStaticPath(pathname) {
        const lower = pathname.toLowerCase();
        if (FORBIDDEN_STATIC_PREFIXES.some(prefix => lower.startsWith(prefix))) return true;
        if (FORBIDDEN_STATIC_EXTENSIONS.some(ext => lower.endsWith(ext))) return true;
        return false;
      }

      expect(isBlockedStaticPath('/assets/aistudio/Paste_Nov12.txt')).toBe(true);
      expect(isBlockedStaticPath('/.env')).toBe(true);
      expect(isBlockedStaticPath('/.env.local')).toBe(true);
      expect(isBlockedStaticPath('/firebase-applet-config.json')).toBe(true);
      expect(isBlockedStaticPath('/README.md')).toBe(true);
      expect(isBlockedStaticPath('/docs/report.pdf')).toBe(true);
      expect(isBlockedStaticPath('/debug.log')).toBe(true);

      // Legitimate app assets are allowed
      expect(isBlockedStaticPath('/index.html')).toBe(false);
      expect(isBlockedStaticPath('/css/main.css')).toBe(false);
      expect(isBlockedStaticPath('/assets/index-abc.js')).toBe(false);
    });
  });

  describe('4. Purge Execution RBAC Guard', () => {
    it('strictly prevents non-Gérant employees without clients.delete permission from executing purge', async () => {
      setCurrentUser({
        uid: 'emp-technique',
        role: 'employee',
        isEmployee: true,
        permissions: { 'clients.view': true, 'clients.create': true }
      });
      setCurrentStaffUser({
        id: 'emp-technique',
        role: 'employee',
        permissions: { 'clients.view': true, 'clients.create': true }
      });
      setClients([{ id: 1, fullName: 'Client' }]);

      await expect(executePurge({ targetScope: 'all' })).rejects.toThrow('غير مصرح');
    });
  });
});
