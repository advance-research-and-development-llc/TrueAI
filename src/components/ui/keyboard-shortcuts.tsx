import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
import { Button } from './button'
import { Separator } from './separator'
import { Badge } from './badge'
import { Keyboard, Command } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface KeyboardShortcut {
  keys: string[]
  description: string
  category: string
}

const shortcuts: KeyboardShortcut[] = [
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'General' },
  { keys: ['Ctrl', 'K'], description: 'Quick search', category: 'General' },
  { keys: ['Esc'], description: 'Close dialogs', category: 'General' },
  
  { keys: ['N'], description: 'New conversation', category: 'Chat' },
  { keys: ['Enter'], description: 'Send message', category: 'Chat' },
  { keys: ['Shift', 'Enter'], description: 'New line in message', category: 'Chat' },
  
  { keys: ['A'], description: 'Create new agent', category: 'Agents' },
  { keys: ['R'], description: 'Run selected agent', category: 'Agents' },
  
  { keys: ['1'], description: 'Go to Chat', category: 'Navigation' },
  { keys: ['2'], description: 'Go to Agents', category: 'Navigation' },
  { keys: ['3'], description: 'Go to Models', category: 'Navigation' },
  { keys: ['4'], description: 'Go to Analytics', category: 'Navigation' },
]

export function KeyboardShortcutsHelper() {
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(true)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setIsOpen(prev => !prev)
        }
      }
      
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <>
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="shadow-lg gap-2"
            >
              <Keyboard size={18} />
              Press <Badge variant="outline" className="px-1.5 py-0.5 text-xs font-mono">?</Badge> for shortcuts
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Keyboard size={24} className="text-primary" />
              </div>
              <div>
                <DialogTitle>Keyboard Shortcuts</DialogTitle>
                <DialogDescription>
                  Speed up your workflow with these keyboard shortcuts
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {categories.map((category, categoryIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.1 }}
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">{category}</h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter(s => s.category === category)
                    .map((shortcut, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: categoryIndex * 0.1 + index * 0.05 }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className="px-2 py-1 text-xs font-mono bg-card shadow-sm"
                              >
                                {key}
                              </Badge>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-xs text-muted-foreground">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                </div>
                {categoryIndex < categories.length - 1 && <Separator className="mt-4" />}
              </motion.div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-3">
              <Command size={20} className="text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Pro Tip</p>
                <p className="text-muted-foreground text-xs">
                  Most shortcuts work when you're not typing in an input field. Press <Badge variant="outline" className="px-1 py-0.5 text-xs font-mono mx-1">?</Badge> anytime to toggle this help dialog.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
