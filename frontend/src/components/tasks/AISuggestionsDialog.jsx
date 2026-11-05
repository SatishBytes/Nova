import { Plus, X } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

const AISuggestionsDialog = ({
  open,
  onClose,
  suggestions,
  onSuggestionsChange,
  onSave,
  saving,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Suggested tasks"
    description="Review and edit these ideas before adding them to the project."
    className="ai-suggestions-dialog"
  >
    <div className="space-y-3">
      {suggestions.map((suggestion, index) => (
        <div key={`suggestion-${index}`} className="flex items-center gap-2">
          <Input
            value={suggestion}
            onChange={(event) => onSuggestionsChange((current) => current.map((item, itemIndex) => (
              itemIndex === index ? event.target.value : item
            )))}
            maxLength={100}
            aria-label={`Suggested task ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove suggested task ${index + 1}`}
            onClick={() => onSuggestionsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
          >
            <X size={15} aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => onSuggestionsChange((current) => [...current, ''])}>
        <Plus size={15} aria-hidden="true" />
        Add another
      </Button>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={onSave} disabled={saving || !suggestions.some((title) => title.trim())}>
          {saving ? 'Saving…' : 'Add tasks'}
        </Button>
      </div>
    </div>
  </Modal>
);

export default AISuggestionsDialog;
