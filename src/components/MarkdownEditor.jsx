import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const TOOLBAR_BUTTONS = [
  { label: 'B',  title: 'Bold',           style: 'font-bold',   action: 'bold' },
  { label: 'I',  title: 'Italic',         style: 'italic',      action: 'italic' },
  { label: 'H1', title: 'Heading 1',      style: '',            action: 'h1' },
  { label: 'H2', title: 'Heading 2',      style: '',            action: 'h2' },
  { label: 'H3', title: 'Heading 3',      style: '',            action: 'h3' },
  { label: '•—', title: 'Bullet list',    style: '',            action: 'ul' },
  { label: '1.', title: 'Numbered list',  style: '',            action: 'ol' },
]

function applyFormat(textarea, value, action) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)

  let newValue, newStart, newEnd

  if (action === 'bold' || action === 'italic') {
    const wrap = action === 'bold' ? '**' : '*'
    const placeholder = action === 'bold' ? 'bold text' : 'italic text'
    if (selected) {
      newValue = value.slice(0, start) + wrap + selected + wrap + value.slice(end)
      newStart = start + wrap.length
      newEnd = end + wrap.length
    } else {
      newValue = value.slice(0, start) + wrap + placeholder + wrap + value.slice(end)
      newStart = start + wrap.length
      newEnd = newStart + placeholder.length
    }
  } else {
    const prefixes = { h1: '# ', h2: '## ', h3: '### ', ul: '- ', ol: '1. ' }
    const prefix = prefixes[action]
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    newStart = start + prefix.length
    newEnd = end + prefix.length
  }

  return { newValue, newStart, newEnd }
}

export default function MarkdownEditor({ value, onChange, placeholder, disabled, className }) {
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef(null)

  function handleFormat(action) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { newValue, newStart, newEnd } = applyFormat(textarea, value, action)
    onChange(newValue)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(newStart, newEnd)
    })
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between bg-[#0f3460] rounded-t px-2 py-1 gap-1 flex-wrap">
        <div className="flex items-center gap-0.5 flex-wrap">
          {TOOLBAR_BUTTONS.map(btn => (
            <button
              key={btn.action}
              type="button"
              title={btn.title}
              disabled={disabled || preview}
              onClick={() => handleFormat(btn.action)}
              className={`px-2 py-0.5 text-xs rounded text-gray-300 hover:bg-[#1a1a2e] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${btn.style}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPreview(v => !v)}
          disabled={disabled}
          className={`px-2 py-0.5 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            preview
              ? 'bg-[#e94560] text-white'
              : 'text-gray-300 hover:bg-[#1a1a2e] hover:text-white'
          }`}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div
          className={`w-full ${className} bg-[#16213e] text-white rounded-b p-3 text-sm overflow-y-auto prose-dark`}
          style={{ minHeight: '4rem' }}
        >
          {value ? (
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-3 mb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-2 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-white mt-2 mb-1">{children}</h3>,
                p:  ({ children }) => <p className="text-gray-200 mb-2">{children}</p>,
                strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                ul: ({ children }) => <ul className="list-disc list-inside text-gray-200 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-gray-200 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-gray-200">{children}</li>,
              }}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full ${className} bg-[#16213e] text-white rounded-b p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#e94560] placeholder-gray-500 disabled:opacity-50`}
        />
      )}
    </div>
  )
}
