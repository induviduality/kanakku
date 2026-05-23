import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'

interface QueryEditorProps {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  disabled?: boolean
}

export default function QueryEditor({ value, onChange, onRun, disabled }: QueryEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="border border-gray-300 rounded-lg overflow-hidden text-sm" aria-label="SQL editor">
        <CodeMirror
          value={value}
          extensions={[sql()]}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
          className="min-h-[120px]"
          editable={!disabled}
        />
      </div>
      {onRun && (
        <div className="flex justify-end">
          <button
            onClick={onRun}
            disabled={disabled || !value.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Run query"
          >
            Run Query
          </button>
        </div>
      )}
    </div>
  )
}
