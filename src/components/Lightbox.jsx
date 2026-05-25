import { useEffect } from 'react'

const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv)$/i

export default function Lightbox({ url, filename, onClose }) {
  const isVideo = VIDEO_EXTS.test(filename)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {isVideo ? (
        <video
          src={url}
          controls
          autoPlay
          className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <img
          src={url}
          alt={filename}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      )}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#e94560] text-white text-xl flex items-center justify-center hover:bg-red-600 transition-colors"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  )
}
