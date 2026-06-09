import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { ERRORS } from '@/constants/errors';
import { slugify } from '@/domain/utils/slugify';
import { logger } from '@/infrastructure/logging/logger';
import { useCreateFlow } from '@/presentation/hooks/flows/useFlows';

/** Kebab-case api_name rule (matches the backend). */
const API_NAME_RE = /^[a-z][a-z0-9-]*$/;

/**
 * "New flow" dialog: collects a display name + kebab api_name and creates an
 * empty flow (`POST /api/flows`). On success it navigates to the flow detail
 * view, where the user authors the graph as YAML. The api_name is seeded from
 * the display name (editable) and validated client-side before submit.
 */
export function NewFlowDialog() {
  const navigate = useNavigate();
  const create = useCreateFlow();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [apiName, setApiName] = useState('');
  const [apiNameTouched, setApiNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveApiName = apiNameTouched ? apiName : slugify(displayName);
  const apiNameValid = API_NAME_RE.test(effectiveApiName);
  const canSubmit = displayName.trim().length > 0 && apiNameValid && !create.isPending;

  const reset = () => {
    setDisplayName('');
    setApiName('');
    setApiNameTouched(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const flow = await create.mutateAsync({
        apiName: effectiveApiName,
        displayName: displayName.trim(),
      });
      setOpen(false);
      reset();
      navigate(`${ROUTES.SETTINGS_FLOWS}/${flow.id}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError(ERRORS.FLW_007.message);
        return;
      }
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' && detail ? detail : ERRORS.FLW_003.message);
      logger.fromError('FLW_003:create', err);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus size={15} /> New flow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New flow</DialogTitle>
          <DialogDescription>
            Create an empty flow, then author its graph as YAML on the next screen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-display-name">Display name</Label>
            <Input
              id="flow-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My research flow"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-api-name">API name</Label>
            <Input
              id="flow-api-name"
              value={effectiveApiName}
              onChange={(e) => {
                setApiNameTouched(true);
                setApiName(e.target.value);
              }}
              placeholder="my-research-flow"
              aria-invalid={!apiNameValid && effectiveApiName.length > 0}
            />
            {!apiNameValid && effectiveApiName.length > 0 && (
              <p className="text-[12px] text-destructive">{ERRORS.FLW_008.message}</p>
            )}
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
