/*
 * Accordion — FAQ (prototype html:L971-987): native <details>/<summary>, no JS behaviour.
 * Author table: question (text or heading) | answer (rich text) | optional "abierta"
 * (open by default).
 */
export default function decorate(block) {
  const faq = document.createElement('div');
  faq.className = 'faq';
  [...block.children].forEach((row) => {
    const [question, answer, flag] = [...row.children];
    if (!question) return;
    const details = document.createElement('details');
    if (flag && flag.textContent.trim()) details.open = true;
    /* SEO: la pregunta es un <h3> dentro del <summary>. Vale con texto normal o con un título
       autorado en DA (se toma su texto e id, así nunca queda un título dentro de otro) */
    const summary = document.createElement('summary');
    const authored = question.querySelector('h1, h2, h3, h4, h5, h6');
    const h3 = document.createElement('h3');
    h3.textContent = (authored || question).textContent.trim();
    if (authored && authored.id) h3.id = authored.id;
    summary.append(h3);
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
