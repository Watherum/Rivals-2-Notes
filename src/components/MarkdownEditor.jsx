import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const TOOLBAR_BUTTONS = [
  { label: 'B',   title: 'Bold',             style: 'font-bold',    action: 'bold' },
  { label: 'I',   title: 'Italic',           style: 'italic',       action: 'italic' },
  { label: 'S',   title: 'Strikethrough',    style: 'line-through', action: 'strike' },
  { label: 'H1',  title: 'Heading 1',        style: '',             action: 'h1' },
  { label: 'H2',  title: 'Heading 2',        style: '',             action: 'h2' },
  { label: 'H3',  title: 'Heading 3',        style: '',             action: 'h3' },
  { label: '•—',  title: 'Bullet list',      style: '',             action: 'ul' },
  { label: '1.',  title: 'Numbered list',    style: '',             action: 'ol' },
  { label: '[ ]', title: 'Checklist',        style: '',             action: 'check' },
  { label: '—',   title: 'Horizontal rule',  style: '',             action: 'hr' },
  { label: '[url]', title: 'Link',           style: '',             action: 'link' },
  { label: '[img]', title: 'Image',          style: '',             action: 'image' },
  { label: '↵',   title: 'New Line',         style: '',             action: 'newline' },
]

function applyFormat(textarea, value, action) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)

  let newValue, newStart, newEnd

  if (action === 'bold' || action === 'italic' || action === 'strike') {
    const wrap = action === 'bold' ? '**' : action === 'italic' ? '*' : '~~'
    const placeholder = action === 'bold' ? 'bold text' : action === 'italic' ? 'italic text' : 'strikethrough text'
    if (selected) {
      newValue = value.slice(0, start) + wrap + selected + wrap + value.slice(end)
      newStart = start + wrap.length
      newEnd = end + wrap.length
    } else {
      newValue = value.slice(0, start) + wrap + placeholder + wrap + value.slice(end)
      newStart = start + wrap.length
      newEnd = newStart + placeholder.length
    }
  } else if (action === 'link' || action === 'image') {
    const prefix = action === 'image' ? '!' : ''
    const label = selected || (action === 'link' ? 'link text' : 'alt text')
    const inserted = `${prefix}[${label}](url)`
    const urlOffset = prefix.length + 1 + label.length + 2
    newValue = value.slice(0, start) + inserted + value.slice(end)
    newStart = start + urlOffset
    newEnd = newStart + 3
  } else if (action === 'hr') {
    const before = end > 0 && value[end - 1] !== '\n' ? '\n\n' : ''
    const insert = `${before}---\n\n`
    newValue = value.slice(0, end) + insert + value.slice(end)
    newStart = end + insert.length
    newEnd = newStart
  } else if (action === 'newline') {
    newValue = value.slice(0, end) + '\n\n' + value.slice(end)
    newStart = end + 2
    newEnd = end + 2
  } else {
    const prefixes = { h1: '# ', h2: '## ', h3: '### ', ul: '- ', ol: '1. ', check: '- [ ] ' }
    const prefix = prefixes[action]
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    newStart = start + prefix.length
    newEnd = end + prefix.length
  }

  return { newValue, newStart, newEnd }
}

export default function MarkdownEditor({ value, onChange, placeholder, disabled, className, onResize }) {
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef(null)
  const outerRef = useRef(null)
  const userWidthRef = useRef(null)
  const userHeightRef = useRef(null)

  useEffect(() => {
    if (preview) return
    const textarea = textareaRef.current
    const outer = outerRef.current
    if (!textarea || !outer) return

    outer.style.width = userWidthRef.current ? userWidthRef.current + 'px' : ''
    if (userHeightRef.current) textarea.style.height = userHeightRef.current

    const ro = new ResizeObserver(() => {
      const w = textarea.offsetWidth
      if (w > 0 && textarea.style.width) {
        userWidthRef.current = w
        outer.style.width = w + 'px'
        onResize?.(w)
      }
      if (textarea.style.height) {
        userHeightRef.current = textarea.style.height
      }
    })
    ro.observe(textarea)
    return () => ro.disconnect()
  }, [preview])

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
    <div ref={outerRef} className="flex flex-col gap-0">
      <div className="flex items-center bg-[#0f3460] rounded-t px-2 py-1 gap-1 flex-wrap">
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
        <button
          type="button"
          onClick={() => {
            if (!preview && textareaRef.current?.style.height) {
              userHeightRef.current = textareaRef.current.style.height
            }
            setPreview(v => !v)
          }}
          disabled={disabled}
          className={`ml-auto px-2 py-0.5 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
          style={{ minHeight: '4rem', ...(userHeightRef.current ? { height: userHeightRef.current } : {}) }}
        >
          {value ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-3 mb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-2 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-white mt-2 mb-1">{children}</h3>,
                p:  ({ children }) => <p className="text-gray-200 mb-2">{children}</p>,
                strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                del: ({ children }) => <del className="line-through text-gray-400">{children}</del>,
                ul: ({ children }) => <ul className="list-disc list-inside text-gray-200 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-gray-200 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children, className: liClass }) => (
                  <li className={`text-gray-200 ${liClass?.includes('task-list-item') ? 'list-none flex items-center gap-2' : ''}`}>{children}</li>
                ),
                input: ({ checked }) => (
                  <input type="checkbox" checked={checked} readOnly className="accent-[#e94560] mt-0.5" />
                ),
                hr: () => <hr className="border-t border-gray-600 my-3" />,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer" className="text-[#e94560] underline hover:text-red-400">{children}</a>
                ),
                img: ({ src, alt }) => (
                  <img src={src} alt={alt} className="max-w-full rounded mt-1 mb-2" />
                ),
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
          className={`w-full ${className} bg-[#16213e] text-white rounded-b p-3 text-sm resize focus:outline-none focus:ring-2 focus:ring-[#e94560] placeholder-gray-500 disabled:opacity-50`}
        />
      )}
    </div>
  )
}
