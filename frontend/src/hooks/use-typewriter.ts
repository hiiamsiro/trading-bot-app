'use client'

import { useEffect, useState } from 'react'

/**
 * Types out text character by character, optionally with a pause before clearing.
 * Returns the partially-typed string so the component can render it.
 */
export function useTypewriter(
  texts: string[],
  {
    typeSpeed = 60,
    deleteSpeed = 35,
    pauseDuration = 2200,
    startDelay = 400,
  } = {},
) {
  const [displayText, setDisplayText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const current = texts[textIndex]

    // Initial start delay — begin typing after the configured pause
    if (displayText === '' && !isDeleting) {
      timeout = setTimeout(() => {
        setDisplayText(current.slice(0, 1))
      }, startDelay)
      return () => clearTimeout(timeout)
    }

    if (!isDeleting) {
      // Typing forward
      if (displayText.length < current.length) {
        timeout = setTimeout(() => {
          setDisplayText(current.slice(0, displayText.length + 1))
        }, typeSpeed)
      } else {
        // Done typing — pause, then delete
        timeout = setTimeout(() => setIsDeleting(true), pauseDuration)
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, deleteSpeed)
      } else {
        // Done deleting — move to next text
        setIsDeleting(false)
        setTextIndex((prev) => (prev + 1) % texts.length)
      }
    }

    return () => clearTimeout(timeout)
  }, [displayText, isDeleting, textIndex, texts, typeSpeed, deleteSpeed, pauseDuration, startDelay])

  return displayText
}
