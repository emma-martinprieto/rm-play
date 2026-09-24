/*
 * Accordion — FAQ (prototype html:L971-987): native <details>/<summary>, no JS behaviour.
 * Author table: question | answer (rich text) | optional "abierta" (open by default).
 */
export default function decorate(block) {
  const faq = document.createElement('div');
  faq.className = 'faq';
  [...block.children].forEach((row) => {
    const [question, answer, flag] = [...row.children];
    if (!question) return;
    const details = document.createElement('details');
    if (flag && flag.textContent.trim()) details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = question.textContent.trim();
    details.append(summary);
    if (answer) {
      answer.querySelectorAll('a[href]').forEach((a) => {
        try {
          if (new URL(a.href).hostname !== window.location.hostname) {
            a.target = '_blank';
            a.rel = 'noopener';
          }
        } catch (e) { /* relative link: keep as is */ }
      });
      details.append(...answer.children);
    }
    faq.append(details);
  });
  block.replaceChildren(faq);
}
