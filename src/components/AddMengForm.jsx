import { useState } from 'react';
import { X, ImagePlus, Loader2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resizeImageToDataUrl } from '../lib/resizeImage';

// Firestore caps documents at 1MB; a resized 240px JPEG is normally a few
// dozen KB, so this only trips on pathological inputs.
const MAX_IMAGE_DATA_URL_LENGTH = 700_000;

export default function AddMengForm({ user, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFileChange(e) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !description.trim() || !file) {
      setError('Name, description, and an image are all required.');
      return;
    }

    setBusy(true);
    try {
      const imageUrl = await resizeImageToDataUrl(file);
      if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        setError('That image is too large even after resizing — try a simpler image.');
        setBusy(false);
        return;
      }

      await addDoc(collection(db, 'meng'), {
        name: name.trim(),
        description: description.trim(),
        imageUrl,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add Meng. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Add Meng</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="mx-auto flex h-28 w-28 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 hover:border-red-400 hover:text-red-500">
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <ImagePlus size={22} />
                <span className="mt-1 text-[11px] font-semibold">Upload image</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pikachu"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When several of these Meng gather, their electricity could build and cause lightning storms."
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Adding…' : 'Add to Dex'}
          </button>
        </form>
      </div>
    </div>
  );
}
