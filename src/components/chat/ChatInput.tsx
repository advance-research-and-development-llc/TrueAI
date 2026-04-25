import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PaperPlaneRight, StopCircle } from '@phosphor-icons/react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isStreaming?: boolean
  onStop?: () => void
}

export function ChatInput({ onSend, disabled, isStreaming, onStop }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <Textarea
        id="chat-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className="min-h-[60px] max-h-[200px] resize-none"
        rows={2}
      />
      
      {isStreaming && onStop ? (
        <Button
          type="button"
          onClick={onStop}
          variant="destructive"
          size="icon"
          className="h-[60px] w-[60px] shrink-0"
        >
          <StopCircle weight="fill" size={24} />
        </Button>
      ) : (
        <Button
          type="submit"
          disabled={disabled || !input.trim()}
          size="icon"
          className="h-[60px] w-[60px] shrink-0"
        >
          <PaperPlaneRight weight="fill" size={24} />
        </Button>
      )}
    </form>
  )
}
