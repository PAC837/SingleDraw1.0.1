const parser = new DOMParser()

/** Parse an XML string into a Document. */
export function parseXmlString(xml: string): Document {
  const doc = parser.parseFromString(xml, 'text/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error(`XML parse error: ${err.textContent}`)
  return doc
}

/** Get a float attribute, returning fallback if missing. */
export function getAttrFloat(el: Element, name: string, fallback = 0): number {
  const val = el.getAttribute(name)
  if (val === null) return fallback
  const n = parseFloat(val)
  return isNaN(n) ? fallback : n
}

/** Get a string attribute, returning fallback if missing. */
export function getAttrStr(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback
}

/** Get a boolean attribute (True/False string). */
export function getAttrBool(el: Element, name: string, fallback = false): boolean {
  const val = el.getAttribute(name)
  if (val === null) return fallback
  return val.toLowerCase() === 'true'
}

/** Get an integer attribute. */
export function getAttrInt(el: Element, name: string, fallback = 0): number {
  const val = el.getAttribute(name)
  if (val === null) return fallback
  const n = parseInt(val, 10)
  return isNaN(n) ? fallback : n
}

/** Get direct child elements matching a tag name. */
export function getChildren(el: Element, tagName: string): Element[] {
  const result: Element[] = []
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].tagName === tagName) {
      result.push(el.children[i])
    }
  }
  return result
}

/** Get first direct child element matching a tag name. */
export function getChild(el: Element, tagName: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].tagName === tagName) return el.children[i]
  }
  return null
}

/** Collect all attributes of an element as a string record. */
export function getAllAttrs(el: Element): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    result[attr.name] = attr.value
  }
  return result
}
