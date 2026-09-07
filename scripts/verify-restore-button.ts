import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function verifyRestoreButton() {
  console.log('=================================================================');
  console.log('NITTOO — RESTORE BACKUP BUTTON VISIBILITY & LAYOUT VERIFICATION');
  console.log('=================================================================');

  const accountPagePath = path.resolve(process.cwd(), 'src/pages/AccountPage.tsx');
  const indexCssPath = path.resolve(process.cwd(), 'src/index.css');
  const modalPath = path.resolve(process.cwd(), 'src/components/RestoreDataModal.tsx');

  const accountPageSrc = fs.readFileSync(accountPagePath, 'utf-8');
  const indexCssSrc = fs.readFileSync(indexCssPath, 'utf-8');
  const modalSrc = fs.readFileSync(modalPath, 'utf-8');

  console.log('\n--- 1. Root Cause & Theme Definition ---');
  // Check index.css has primary color tokens defined so primary-* classes resolve properly
  assert(indexCssSrc.includes('--color-primary-600: #2D6A4F;'), 'index.css defines --color-primary-600');
  assert(indexCssSrc.includes('--color-primary-700: #24563F;'), 'index.css defines --color-primary-700');
  assert(indexCssSrc.includes('--color-primary-50: #EBF4F0;'), 'index.css defines --color-primary-50');

  console.log('\n--- 2. Restore Backup Button Visual Styling & Text ---');
  // 1. Text is visibly rendered
  assert(accountPageSrc.includes('<span>Restore Backup</span>'), 'Restore Backup text is explicitly rendered in button span');
  // 2. High contrast background color
  assert(accountPageSrc.includes('bg-[#2D6A4F]'), 'Restore Backup button has explicit brand green background #2D6A4F');
  // 3. Hover state
  assert(accountPageSrc.includes('hover:bg-[#24563F]'), 'Restore Backup button has distinct darker green hover state #24563F');
  // 4. White text on dark green (high contrast, no white-on-white)
  assert(accountPageSrc.includes('text-white'), 'Restore Backup button uses text-white on dark background');
  // 5. Min interactive height >= 44px
  assert(accountPageSrc.includes('min-h-[44px]'), 'Restore Backup button enforces 44px minimum interactive height');
  // 6. Focus state
  assert(accountPageSrc.includes('focus:ring-[#2D6A4F]/40'), 'Restore Backup button has visible focus ring');

  console.log('\n--- 3. Download Backup Button Hierarchy ---');
  assert(accountPageSrc.includes('Download Backup'), 'Download Backup text is visibly rendered');
  assert(accountPageSrc.includes('bg-white'), 'Download Backup has white surface background');
  assert(accountPageSrc.includes('border-[#E8ECE9]'), 'Download Backup has distinct #E8ECE9 border');
  assert(accountPageSrc.includes('text-neutral-700'), 'Download Backup has dark readable neutral text');
  assert(accountPageSrc.includes('min-h-[44px]'), 'Download Backup button enforces 44px minimum interactive height');

  console.log('\n--- 4. Interaction Target & Accessibility ---');
  // Ensure the button element itself holds the click handler (not an empty wrapper)
  assert(
    accountPageSrc.includes('onClick={() => setIsRestoreModalOpen(true)}') &&
    accountPageSrc.includes('<button\n                  type="button"\n                  onClick={() => setIsRestoreModalOpen(true)}'),
    'Click handler is directly bound to the visible <button> element'
  );
  assert(accountPageSrc.includes('aria-label="Restore Backup"'), 'Button includes accessible aria-label="Restore Backup"');

  console.log('\n--- 5. Responsive Layout ---');
  // Buttons container is flex-col on mobile, sm:flex-row on desktop
  assert(
    accountPageSrc.includes('flex flex-col sm:flex-row sm:items-center gap-2.5 self-stretch sm:self-auto shrink-0'),
    'Responsive flex layout: vertical stack on mobile (self-stretch), horizontal row on desktop'
  );

  console.log('\n--- 6. RestoreDataModal Consistency ---');
  // Check modal buttons use brand green instead of unresolved classes
  assert(modalSrc.includes('bg-[#2D6A4F] hover:bg-[#24563F] text-white'), 'RestoreDataModal buttons use consistent brand green');
  assert(!modalSrc.includes('bg-primary-600'), 'No unresolved bg-primary-600 classes remain in modal');

  console.log('\n=================================================================');
  console.log('✅ ALL RESTORE BUTTON VISIBILITY & LAYOUT CHECKS PASSED!');
  console.log('=================================================================\n');
}

verifyRestoreButton().catch((err) => {
  console.error('Fatal failure:', err);
  process.exit(1);
});
