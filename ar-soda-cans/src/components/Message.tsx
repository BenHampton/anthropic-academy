type MessageProps = {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

/** centred panel used for every blocking state: permission, errors, setup */
export const Message = ({ title, body, actionLabel, onAction }: MessageProps) => (
  <div className="message">
    <div className="message__panel">
      <h1 className="message__title">{title}</h1>
      <p className="message__body">{body}</p>
      {actionLabel && onAction && (
        <button className="message__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  </div>
)
