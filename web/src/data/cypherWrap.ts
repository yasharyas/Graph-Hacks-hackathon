// Where a Cypher line may wrap besides its spaces. A pattern like `(m:Maintainer)-[:MAINTAINS]->(p:Package)` or a parameter
// list like `versions=["debug@4.4.2","chalk@5.6.1"]` has no space for 60+ characters; in a 270px column it would otherwise
// break mid-identifier (overflow-wrap: anywhere) or overflow. The pieces join back to the identical text: the component puts a
// <wbr> between them, which adds no character to a selection or a copy. Pure: node --test covers it.

/** After a closing bracket, a comma or an arrow head, when more of the same token follows: `(a)` | `-[:R]` | `->` | `(b)`. */
const JOINT = /(?<=[)\]},>])(?=[^\s,;)\]}])/;

export function cypherPieces(text: string): string[] {
  return text.split(JOINT);
}
