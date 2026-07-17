/**
 * Infobulle native (attribut title) reprenant une définition verrouillée ou
 * une méthode de calcul (PRD §4.8 : « chaque indicateur porte une infobulle
 * reprenant exactement les définitions verrouillées »).
 */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span aria-hidden title={text} className="cursor-help text-xs text-text-muted">
      ⓘ
    </span>
  );
}
