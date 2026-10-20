import DOMPurify from 'dompurify';

export function sanitizeNotification(message: string): string {
  const fragment = DOMPurify.sanitize(message, {
    ALLOWED_TAGS: ['a', 'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of fragment.querySelectorAll('*')) {
    if (element.tagName !== 'A') {
      for (const attribute of element.getAttributeNames()) element.removeAttribute(attribute);
      continue;
    }
    const href = element.getAttribute('href');
    if (!href || !/^(https?:\/\/|mailto:)/i.test(href)) element.removeAttribute('href');
    if (element.getAttribute('target')?.toLowerCase() === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}
