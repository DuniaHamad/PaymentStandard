//kommunikation mit der PayPal API für die Verarbeitung von Bestellungen und Zahlungen
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable, switchMap } from 'rxjs';
import { Product } from '../product.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // Sandbox-URL der PayPal API für Testzwecke
  private paypalApiUrl = 'https://api-m.sandbox.paypal.com/v2/checkout/orders';
  // Authentifizierungsdetails für die PayPal API. Diese werden zur Generierung eines Authentifizierungstokens benötigt.
  private clientId = 'ATZFarfzWZCA0DB05S_7xGNEx7Gz_d_KAl7BkJwgaKBZgfpptY-mVw7jv0z9ctTHq92axuaQiPKg9xAu';
  private clientSecret = 'ELT7A8oH6oPX1dHT5qhV11H1A-4Zl4VHX2DoROMxj77EuBY_d3smWPDUe_7cQqNw_T95jxTky7TgHlcV';

  constructor(private http: HttpClient) {}

  //  holt ein OAuth 2.0-Zugriffstoken von PayPal.
  //  Dieses Token wird verwendet, um sich bei der PayPal API zu authentifizieren
  //  und autorisierte Anfragen an die API zu stellen.
  private getAuthToken(): Observable<string> {
    const tokenUrl = 'https://api-m.sandbox.paypal.com/v1/oauth2/token';
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      // btoa() kodiert eine Zeichenkette in Base64.
      Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
    });
    const body = 'grant_type=client_credentials';

    return this.http.post(tokenUrl, body, { headers }).pipe(
      map((response: any) => response.access_token)
    );
  }

  createOrder(cart: { product: Product; quantity: number }[]): Observable<any> {
    return this.getAuthToken().pipe(
      switchMap((accessToken) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        });

        const body = {
          intent: 'CAPTURE',
          //Informationen zu jedem Kaufartikel
          purchase_units: cart.map((item, index) => ({
            reference_id: `PU_${index + 1}`, // Eindeutige reference_id für jede purchase_unit
            amount: {
              currency_code: 'EUR',
              value: (item.product.price * item.quantity).toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: 'EUR',
                  value: (item.product.price * item.quantity).toFixed(2),
                },
              },
            },
            items: [
              {
                name: item.product.name,
                unit_amount: {
                  currency_code: 'EUR',
                  value: item.product.price.toFixed(2),
                },
                quantity: item.quantity,
              },
            ],
          })),
          application_context: {
            brand_name: 'Schmuck Shop',
            user_action: 'PAY_NOW',
          },
        };

        return this.http.post(this.paypalApiUrl, body, { headers });
      })
    );
  }

  //Erfasst die Zahlung für eine bereits erstellte Bestellung.
  captureOrder(orderId: string): Observable<any> {
    return this.getAuthToken().pipe(
      switchMap((accessToken) => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        });

        const captureUrl = `${this.paypalApiUrl}/${orderId}/capture`;

        return this.http.post(captureUrl, {}, { headers });
      })
    );
  }
}
