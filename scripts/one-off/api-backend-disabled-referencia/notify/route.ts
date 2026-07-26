import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Faltan las variables de entorno VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
}

webpush.setVapidDetails(
  'mailto:fran@ateliervirtual.art',
  vapidPublicKey,
  vapidPrivateKey
);

interface NotifyPayload {
  title?: string;
  body?: string;
  image?: string;
}

interface Suscriptor {
  subscription_data: webpush.PushSubscription;
}

export async function POST(request: NextRequest) {
  try {
    const dataReceived: NotifyPayload = await request.json().catch(() => ({}));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Faltan las variables de entorno de Supabase.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: subs, error: dbError } = await supabase
      .from('suscriptores')
      .select('subscription_data')
      .not('subscription_data', 'is', null);

    if (dbError) throw dbError;

    const payload = JSON.stringify({
      title: dataReceived.title || "Nuevo arte",
      body: dataReceived.body || "Hay algo nuevo en el Atelier.",
      icon: "/icon.png",
      image: dataReceived.image,
      url: "/"
    });

    const results = await Promise.all(
      ((subs as Suscriptor[] | null) || []).map(sub =>
        webpush.sendNotification(sub.subscription_data, payload)
          .catch((err: webpush.WebPushError) => console.error("Error de envio:", err.endpoint))
      )
    );

    return NextResponse.json({ success: true, sent: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
