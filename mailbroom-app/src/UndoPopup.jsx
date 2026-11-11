export default function UndoPopup({ pending, onUndo }) {
  return (
    <div className="undo-container">
      {pending.map((s) => (
        <div key={s.from} className="undo-bar">
          Unsubscribing from {s.from}...{' '}
          <button onClick={() => onUndo(s)}>Undo</button>
        </div>
      ))}
    </div>
  );
}