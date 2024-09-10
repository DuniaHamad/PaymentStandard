import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CurrencyPipe, NgForOf } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "./services/api.service";
import { Product } from './product.model';
import {lastValueFrom} from "rxjs";
declare var paypal: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CurrencyPipe, NgForOf, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  apiService: ApiService = inject(ApiService);
  title = 'paypal-standard';

  products: Product[] = [
    {
      id: 1,
      name: 'Handgefertigter Silberring',
      description: 'Ein wunderschöner handgefertigter Silberring mit filigranem Design.',
      price: 49.99,
      taxRate: 0.19,
      imageUrl: 'assets/silberring.jpg',
      quantity: 1
    },
    {
      id: 2,
      name: 'Goldene Halskette',
      description: 'Elegante goldene Halskette mit einem funkelnden Anhänger.',
      price: 79.99,
      taxRate: 0.19,
      imageUrl: 'assets/gold-kette.jpg',
      quantity: 1
    },
    {
      id: 3,
      name: 'Armbanduhr mit Lederarmband',
      description: 'Stilvolle Armbanduhr mit einem hochwertigen Lederarmband.',
      price: 120.00,
      taxRate: 0.19,
      imageUrl: 'assets/leder-uhr.jpg',
      quantity: 1
    },
    {
      id: 4,
      name: 'Perlenohrringe',
      description: 'Schöne Ohrringe mit echten Süßwasserperlen.',
      price: 39.99,
      taxRate: 0.19,
      imageUrl: 'assets/perlen-ohrringe.jpg',
      quantity: 1
    }
  ];

  cart: { product: Product; quantity: number }[] = [];

  ngOnInit(): void {
    this.loadPayPalScript().then(() => {
      this.renderPayPalButton();
    });
  }

  //lädt das Paypal SDK dynamisch
  loadPayPalScript(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.paypal.com/sdk/js?client-id=ATZFarfzWZCA0DB05S_7xGNEx7Gz_d_KAl7BkJwgaKBZgfpptY-mVw7jv0z9ctTHq92axuaQiPKg9xAu&currency=EUR';
      script.onload = () => resolve();
      script.onerror = (error) => {
        console.error('Error loading PayPal script:', error);
        reject(error);
      };
      document.body.appendChild(script);
    });
  }

  // setzt den Paypal Button mit der Logik für die Erstellung und Genehmigung von Bestellungen
  renderPayPalButton(): void {
    paypal.Buttons({
      createOrder: async () => {
        try {
          return await lastValueFrom(this.apiService.createOrder(this.cart)).then((response: any) => response.id);
        } catch (error) {
          console.error('Error creating order:', error);
          throw error;
        }
      },
      onApprove: async (data: { orderID: string }) => {
        const orderId = data.orderID;

        this.apiService.captureOrder(orderId)
          .subscribe({
            next: (response) => {
              console.log('Zahlung erfolgreich erfasst:', response);
              this.resultMessage('Zahlung erfolgreich! Vielen Dank für Ihren Einkauf.');
              this.resetCart();
            },
            error: (error) => {
              console.error('Fehler beim Erfassen der Zahlung:', error);
              this.resultMessage('Fehler bei der Zahlung, bitte versuchen Sie es erneut.');
            }
          });
      },
      onError: (err: any) => {
        console.error('PayPal Button onError:', err);
        this.resultMessage('Fehler bei der PayPal-Zahlung. Bitte versuchen Sie es erneut. Fehlerdetails: ' + JSON.stringify(err));
      }

    }).render("#paypal-button-container");
  }

  addToCart(product: Product): void {
    console.log('Produkt hinzugefügt zum Warenkorb:', product);
    const existingProduct = this.cart.find(item => item.product.id === product.id);
    if (existingProduct) {
      existingProduct.quantity += product.quantity;
    } else {
      this.cart.push({ product, quantity: product.quantity });
    }
  }

  calculateTotal(): { subtotal: number; totalTax: number; total: number } {
    // acc ist Akkumulator, die bisherige Gesamtpreis berechnet
    const subtotal = this.cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    const totalTax = this.cart.reduce((acc, item) => acc + (item.product.price * item.product.taxRate * item.quantity), 0);
    const total = subtotal + totalTax;

    return { subtotal, totalTax, total };
  }

  resultMessage(message: string): void {
    const container = document.querySelector("#result-message");
    if (container) {
      container.innerHTML = message;
    }
    console.log('Ergebnisnachricht:', message);
  }

  resetCart(): void {
    this.cart = [];
    }

}
