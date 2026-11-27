'use client';
import { useEffect, useRef } from 'react';

export default function PublicInteractions() {
  const dialogRef = useRef(null);
  const photoRef = useRef(null);
  useEffect(() => {
    const click = (event) => {
      const photo = event.target.closest('[data-editor-gallery] a[data-gallery-photo]');
      const image = photo?.querySelector('img');
      if (image && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        photoRef.current.src = image.currentSrc || image.src;
        photoRef.current.alt = image.alt;
        dialogRef.current.showModal();
        return;
      }
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
  return <dialog ref={dialogRef} className="gallery-lightbox" aria-label="Gallery photo"
    onClick={event => { if (event.target === event.currentTarget) dialogRef.current.close(); }}>
    <button type="button" onClick={()=>dialogRef.current.close()}>Close</button>
    <img ref={photoRef} alt="" />
  </dialog>;
}
