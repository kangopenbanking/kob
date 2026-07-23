import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload, Image, Type, Save, Palette} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { adminStorageUpload } from '@/lib/admin/adminStorageUpload';

interface ConfigRow {
  id: string;
  config_key: string;
  config_value: string;
  config_type: string;
  description: string | null;
}

const AuthBrandingManager = () => {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('auth_page_config')
        .select('*')
        .order('config_key');

      if (error) throw error;
      setConfigs(data || []);
      const values: Record<string, string> = {};
      (data || []).forEach((c: ConfigRow) => { values[c.config_key] = c.config_value; });
      setEditedValues(values);
    } catch (err) {
      toast.error('Failed to load auth branding config');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (configKey: string, file: File) => {
    setUploading(configKey);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${configKey}-${Date.now()}.${ext}`;

      const { publicUrl } = await adminStorageUpload({
        bucket: 'auth-branding',
        path: fileName,
        file,
        contentType: file.type,
        upsert: true,
      });

      setEditedValues(prev => ({ ...prev, [configKey]: publicUrl }));
      toast.success('Image uploaded successfully');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Upload failed'));
    } finally {
      setUploading(null);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      for (const config of configs) {
        const newValue = editedValues[config.config_key];
        if (newValue !== config.config_value) {
          const { error } = await (supabase as any)
            .from('auth_page_config')
            .update({
              config_value: newValue,
              updated_at: new Date().toISOString(),
              updated_by: user?.id,
            })
            .eq('config_key', config.config_key);

          if (error) throw error;
        }
      }

      toast.success('Auth branding updated successfully');
      fetchConfigs();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const formatLabel = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (loading) {
    return (
      <div className="space-y-6">
      <AdminPageHeader icon={Palette} title="Auth Page Branding" description="Manage the login and signup page appearance" />
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"  />
        </div>
      </div>
    );
  }

  const textConfigs = configs.filter(c => c.config_type === 'text');
  const imageConfigs = configs.filter(c => c.config_type === 'image_url');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Auth Page Branding</h2>
          <p className="text-muted-foreground">Manage the login and signup page appearance</p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save All Changes
        </Button>
      </div>

      {/* Text Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Text Content
          </CardTitle>
          <CardDescription>Edit titles and subtitles shown on the auth pages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {textConfigs.map(config => (
            <div key={config.config_key} className="space-y-1">
              <Label>{formatLabel(config.config_key)}</Label>
              {config.description && (
                <p className="text-xs text-muted-foreground">{config.description}</p>
              )}
              {(config.config_key.includes('subtitle') || config.config_key.includes('description')) ? (
                <Textarea
                  value={editedValues[config.config_key] || ''}
                  onChange={e => setEditedValues(prev => ({ ...prev, [config.config_key]: e.target.value }))}
                  rows={2}
                />
              ) : (
                <Input
                  value={editedValues[config.config_key] || ''}
                  onChange={e => setEditedValues(prev => ({ ...prev, [config.config_key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Image Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Images
          </CardTitle>
          <CardDescription>Upload logo and hero images for the auth pages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {imageConfigs.map(config => (
            <div key={config.config_key} className="space-y-2">
              <Label>{formatLabel(config.config_key)}</Label>
              {config.description && (
                <p className="text-xs text-muted-foreground">{config.description}</p>
              )}

              {editedValues[config.config_key] && (
                <div className="relative w-full max-w-xs rounded-lg border overflow-hidden bg-muted">
                  <img
                    src={editedValues[config.config_key]}
                    alt={config.config_key}
                    className="w-full h-32 object-contain"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={editedValues[config.config_key] || ''}
                  onChange={e => setEditedValues(prev => ({ ...prev, [config.config_key]: e.target.value }))}
                  placeholder="Image URL or upload below"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(config.config_key, file);
                    }}
                  />
                  <Button variant="outline" size="icon" asChild disabled={uploading === config.config_key}>
                    <span>
                      {uploading === config.config_key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>Preview how the auth page will look</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border overflow-hidden min-h-[300px]">
            {/* Form Preview */}
            <div className="p-6 flex flex-col items-center justify-center bg-background">
              {editedValues.logo_url && (
                <img src={editedValues.logo_url} alt="Logo" className="h-12 w-12 mb-4" />
              )}
              <h3 className="text-xl font-bold">{editedValues.login_title || 'Welcome Back'}</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                {editedValues.login_subtitle || 'Sign in to your account'}
              </p>
            </div>

            {/* Hero Preview */}
            <div
              className="relative flex items-center justify-center min-h-[200px]"
              style={{
                backgroundImage: editedValues.hero_image_url
                  ? `url(${editedValues.hero_image_url})`
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: editedValues.hero_image_url ? undefined : 'hsl(var(--primary))',
              }}
            >
              {editedValues.hero_image_url && (
                <div className="absolute inset-0 bg-black/40" />
              )}
              <div className="relative text-center text-white p-4">
                <h2 className="text-2xl font-bold drop-shadow-lg">
                  {editedValues.hero_title || 'Welcome to KOB'}
                </h2>
                <p className="text-sm mt-1 drop-shadow">
                  {editedValues.hero_subtitle || 'Secure Open Banking Platform'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthBrandingManager;
