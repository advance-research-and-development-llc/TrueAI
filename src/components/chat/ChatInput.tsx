import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PaperPlaneRight, StopCircle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isStreaming?: boolean
  onStop?: () => void
}

export function ChatInput({ onSend, disabled, isStreaming, onStop }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current && !disabled && !isStreaming) {
      textareaRef.current.focus()
    }
  }, [disabled, isStreaming])

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

  const charCount = input.length
  const showCharCount = charCount > 100

  return (
    <TooltipProvider>
      <form onSubmit={handleSubmit} className="relative">
        <div className={`flex gap-2 items-end transition-all duration-200 ${
          isFocused ? 'ring-2 ring-accent/30 rounded-lg p-2' : 'p-0'
        }`}>
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Type your message... (Shift+Enter for new line)"
              disabled={disabled}
              className="min-h-[60px] max-h-[200px] resize-none pr-16"
              rows={2}
            />
            
            <AnimatePresence>
              {showCharCount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded"
                >
                  {charCount}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {isStreaming && onStop ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={onStop}
                  variant="destructive"
                  size="icon"
                  className="h-[60px] w-[60px] shrink-0 hover:scale-105 transition-transform"
                >
                  <StopCircle weight="fill" size={24} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Stop generation (Esc)</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="submit"
                    disabled={disabled || !input.trim()}
                    size="icon"
                    className="h-[60px] w-[60px] shrink-0 relative overflow-hidden"
                  >
                    <motion.div
                      animate={input.trim() ? { 
                        rotate: [0, -10, 10, 0],
                        transition: { duration: 0.5, repeat: 0 }
                      } : {}}
                    >
                      <PaperPlaneRight weight="fill" size={24} />
                    </motion.div>
                    {!disabled && input.trim() && (
                      <motion.div
                        className="absolute inset-0 bg-accent/20"
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send message (Enter)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute -top-8 left-0 text-xs text-muted-foreground"
            >
              Press Enter to send • Shift+Enter for new line
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </TooltipProvider>
  )
}
