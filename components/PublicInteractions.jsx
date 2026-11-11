'use client';
import { useEffect } from 'react';

export default function PublicInteractions() {
  useEffect(() => {
    const click = (event) => {
      const opener = event.target.closest('.picture-grid a[href^="#img"]');
      const closer = event.target.closest('.lightbox .close');
      if (opener) {
        event.preventDefault();
        const target = document.querySelector(opener.getAttribute('href'));
        if (target) target.style.display = 'flex';
      }
      if (closer) {
        event.preventDefault();
        closer.closest('.lightbox').style.display = 'none';
      }
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);
  return null;
}
