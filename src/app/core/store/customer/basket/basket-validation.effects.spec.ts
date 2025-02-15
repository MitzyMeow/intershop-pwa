import { Location } from '@angular/common';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action, Store } from '@ngrx/store';
import { cold, hot } from 'jasmine-marbles';
import { Observable, noop, of, throwError, toArray } from 'rxjs';
import { anything, instance, mock, verify, when } from 'ts-mockito';

import { BasketValidation } from 'ish-core/models/basket-validation/basket-validation.model';
import { CheckoutStepType } from 'ish-core/models/checkout/checkout-step.type';
import { Product } from 'ish-core/models/product/product.model';
import { BasketService } from 'ish-core/services/basket/basket.service';
import { CoreStoreModule } from 'ish-core/store/core/core-store.module';
import { loadServerConfigSuccess } from 'ish-core/store/core/server-config';
import { CustomerStoreModule } from 'ish-core/store/customer/customer-store.module';
import { createOrder } from 'ish-core/store/customer/orders';
import { loadProductSuccess } from 'ish-core/store/shopping/products';
import { makeHttpError } from 'ish-core/utils/dev/api-service-utils';
import { BasketMockData } from 'ish-core/utils/dev/basket-mock-data';

import { BasketValidationEffects } from './basket-validation.effects';
import {
  continueCheckout,
  continueCheckoutFail,
  continueCheckoutSuccess,
  continueCheckoutWithIssues,
  loadBasketSuccess,
  startCheckout,
  startCheckoutFail,
  startCheckoutSuccess,
  submitBasket,
  validateBasket,
} from './basket.actions';

describe('Basket Validation Effects', () => {
  let actions$: Observable<Action>;
  let basketServiceMock: BasketService;
  let effects: BasketValidationEffects;
  let store: Store;
  let location: Location;

  beforeEach(() => {
    basketServiceMock = mock(BasketService);

    TestBed.configureTestingModule({
      imports: [
        CoreStoreModule.forTesting(['serverConfig']),
        CustomerStoreModule.forTesting('user', 'basket'),
        RouterTestingModule.withRoutes([
          { path: 'checkout', children: [{ path: 'address', children: [] }] },
          { path: 'checkout', children: [{ path: 'review', children: [] }] },
          { path: 'basket', children: [] },
          { path: '**', children: [] },
        ]),
      ],
      providers: [
        { provide: BasketService, useFactory: () => instance(basketServiceMock) },
        BasketValidationEffects,
        provideMockActions(() => actions$),
      ],
    });

    effects = TestBed.inject(BasketValidationEffects);
    store = TestBed.inject(Store);
    location = TestBed.inject(Location);
  });

  describe('startCheckout$', () => {
    const basketValidation: BasketValidation = {
      basket: BasketMockData.getBasket(),
      results: {
        valid: true,
        adjusted: false,
      },
    };

    beforeEach(() => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(of(basketValidation));
      store.dispatch(
        loadServerConfigSuccess({
          config: { basket: { acceleration: true } },
        })
      );

      store.dispatch(
        loadBasketSuccess({
          basket: BasketMockData.getBasket(),
        })
      );
      store.dispatch(loadProductSuccess({ product: { sku: 'SKU' } as Product }));
    });

    it('should map to action of type ContinueCheckout without basket acceleration', () => {
      store.dispatch(
        loadServerConfigSuccess({
          config: { basket: { acceleration: false } },
        })
      );

      const action = startCheckout();
      const completion = continueCheckout({
        targetStep: CheckoutStepType.Addresses,
      });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.startCheckoutWithoutAcceleration$).toBeObservable(expected$);
    });

    it('should call the basketService for startCheckoutWithAcceleration', done => {
      const action = startCheckout();
      actions$ = of(action);

      effects.startCheckoutWithAcceleration$.subscribe(() => {
        verify(basketServiceMock.validateBasket(anything())).once();
        done();
      });
    });

    it('should map invalid request to action of type startCheckoutFail', () => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(
        throwError(() => makeHttpError({ message: 'invalid' }))
      );

      const action = startCheckout();
      const completion = startCheckoutFail({ error: makeHttpError({ message: 'invalid' }) });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.startCheckoutWithAcceleration$).toBeObservable(expected$);
    });

    it('should map a valid request to action of type startCheckoutSuccess', () => {
      const action = startCheckout();

      const completion = startCheckoutSuccess({
        targetRoute: undefined,
        basketValidation,
      });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.startCheckoutWithAcceleration$).toBeObservable(expected$);
    });
  });

  describe('continueCheckoutWithAcceleration$', () => {
    const basketValidation: BasketValidation = {
      basket: BasketMockData.getBasket(),
      results: {
        valid: true,
        adjusted: false,
      },
    };

    beforeEach(() => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(of(basketValidation));
      store.dispatch(
        loadServerConfigSuccess({
          config: { basket: { acceleration: true } },
        })
      );

      store.dispatch(
        loadBasketSuccess({
          basket: BasketMockData.getBasket(),
        })
      );
      store.dispatch(loadProductSuccess({ product: { sku: 'SKU' } as Product }));
    });

    it('should call the basketService if validation results are valid and not adjusted', done => {
      const action = startCheckoutSuccess({ basketValidation });
      actions$ = of(action);

      effects.continueCheckoutWithAcceleration$.subscribe(() => {
        verify(basketServiceMock.validateBasket(anything())).once();
        done();
      });
    });

    it('should not call the basketService if validation results are invalid', done => {
      const action = startCheckoutSuccess({
        basketValidation: { ...basketValidation, results: { valid: false, adjusted: false } },
      });
      actions$ = of(action);

      effects.continueCheckoutWithAcceleration$.subscribe({
        next: () => {
          verify(basketServiceMock.validateBasket(anything())).never();
        },
        error: fail,
        complete: done,
      });
    });

    it('should not call the basketService if validation results are adjusted', done => {
      const action = startCheckoutSuccess({
        basketValidation: { ...basketValidation, results: { valid: true, adjusted: true } },
      });
      actions$ = of(action);

      effects.continueCheckoutWithAcceleration$.subscribe({
        next: () => {
          verify(basketServiceMock.validateBasket(anything())).never();
        },
        error: fail,
        complete: done,
      });
    });
  });

  describe('validateBasket$', () => {
    const basketValidation: BasketValidation = {
      basket: BasketMockData.getBasket(),
      results: {
        valid: true,
        adjusted: false,
      },
    };

    beforeEach(() => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(of(basketValidation));

      store.dispatch(
        loadBasketSuccess({
          basket: BasketMockData.getBasket(),
        })
      );
      store.dispatch(loadProductSuccess({ product: { sku: 'SKU' } as Product }));
    });

    it('should call the basketService for validateBasket', done => {
      const action = validateBasket({ scopes: ['Products'] });
      actions$ = of(action);

      effects.validateBasket$.subscribe(() => {
        verify(basketServiceMock.validateBasket(anything())).once();
        done();
      });
    });

    it('should map to action of type ContinueCheckoutSuccess', () => {
      const action = validateBasket({ scopes: ['Products'] });
      const completion = continueCheckoutSuccess({
        targetRoute: undefined,
        basketValidation,
      });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.validateBasket$).toBeObservable(expected$);
    });

    it('should map invalid request to action of type ContinueCheckoutFail', () => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(
        throwError(() => makeHttpError({ message: 'invalid' }))
      );

      const action = validateBasket({ scopes: ['Products'] });
      const completion = continueCheckoutFail({ error: makeHttpError({ message: 'invalid' }) });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.validateBasket$).toBeObservable(expected$);
    });

    it('should map to action of type ContinueCheckoutWithIssues if basket is not valid', () => {
      const action = validateBasket({ scopes: ['Products'] });
      basketValidation.results.valid = false;
      const completion = continueCheckoutWithIssues({
        targetRoute: undefined,
        basketValidation,
      });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.validateBasket$).toBeObservable(expected$);
    });
  });

  describe('validateBasketAndContinueCheckout$', () => {
    const basketValidation: BasketValidation = {
      basket: BasketMockData.getBasket(),
      results: {
        valid: true,
        adjusted: false,
      },
    };

    beforeEach(() => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(of(basketValidation));

      store.dispatch(
        loadBasketSuccess({
          basket: BasketMockData.getBasket(),
        })
      );
      store.dispatch(loadProductSuccess({ product: { sku: 'SKU' } as Product }));
    });

    it('should call the basketService for validateBasketAndContinueCheckout', done => {
      const action = continueCheckout({ targetStep: CheckoutStepType.Addresses });
      actions$ = of(action);

      effects.validateBasketAndContinueCheckout$.subscribe(() => {
        verify(basketServiceMock.validateBasket(anything())).once();
        done();
      });
    });

    it('should map to action of type ContinueCheckoutSuccess if targetStep is not 5 (order creation)', () => {
      const action = continueCheckout({ targetStep: CheckoutStepType.Addresses });
      const completion = continueCheckoutSuccess({
        targetRoute: '/checkout/address',
        basketValidation,
      });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.validateBasketAndContinueCheckout$).toBeObservable(expected$);
    });

    it('should map to action of type CreateOrder if targetStep is 5 (order creation)', () => {
      const action = continueCheckout({ targetStep: CheckoutStepType.Receipt });
      const completion1 = continueCheckoutSuccess({ targetRoute: undefined, basketValidation });
      const completion2 = createOrder();
      actions$ = hot('-a----a----a', { a: action });
      const expected$ = cold('-(cd)-(cd)-(cd)', { c: completion1, d: completion2 });

      expect(effects.validateBasketAndContinueCheckout$).toBeObservable(expected$);
    });

    it('should map to action of type SubmitBasket if targetStep is 5 (order creation) and approval is required', () => {
      store.dispatch(
        loadBasketSuccess({
          basket: { ...BasketMockData.getBasket(), approval: { approvalRequired: true } },
        })
      );

      const action = continueCheckout({ targetStep: CheckoutStepType.Receipt });
      const completion1 = continueCheckoutSuccess({ targetRoute: undefined, basketValidation });
      const completion2 = submitBasket();
      actions$ = hot('-a----a----a', { a: action });
      const expected$ = cold('-(cd)-(cd)-(cd)', { c: completion1, d: completion2 });

      expect(effects.validateBasketAndContinueCheckout$).toBeObservable(expected$);
    });

    it('should map invalid request to action of type ContinueCheckoutFail', () => {
      when(basketServiceMock.validateBasket(anything())).thenReturn(
        throwError(() => makeHttpError({ message: 'invalid' }))
      );

      const action = continueCheckout({ targetStep: CheckoutStepType.Addresses });
      const completion = continueCheckoutFail({ error: makeHttpError({ message: 'invalid' }) });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.validateBasketAndContinueCheckout$).toBeObservable(expected$);
    });

    it('should navigate to the next checkout route after ContinueCheckoutSuccess if the basket is valid', fakeAsync(() => {
      const action = continueCheckoutSuccess({ targetRoute: '/checkout/address', basketValidation });
      actions$ = of(action);

      effects.jumpToNextCheckoutStep$.subscribe({ next: noop, error: fail, complete: noop });

      tick(500);

      expect(location.path()).toEqual('/checkout/address');
    }));

    it('should navigate to the error related route after ContinueCheckoutWithIssues if the basket is not valid', fakeAsync(() => {
      const basketValidationWithIssue: BasketValidation = {
        basket: BasketMockData.getBasket(),
        results: {
          valid: false,
          adjusted: false,
          errors: [{ code: '1234', message: 'error', parameters: { scopes: ['Addresses'] } }],
        },
      };
      const action = continueCheckoutWithIssues({
        targetRoute: 'auto',
        basketValidation: basketValidationWithIssue,
      });
      actions$ = of(action);

      effects.jumpToNextCheckoutStep$.subscribe({ next: noop, error: fail, complete: noop });

      tick(500);

      expect(location.path()).toEqual('/checkout/address?error=true');
    }));

    it('should map to action of type ContinueCheckoutWithIssues if basket is not valid', () => {
      const action = continueCheckout({ targetStep: CheckoutStepType.Addresses });
      basketValidation.results.valid = false;
      const completion = continueCheckoutWithIssues({
        targetRoute: '/checkout/address',
        basketValidation,
      });
      actions$ = hot('-a', { a: action });
      const expected$ = cold('-c', { c: completion });

      expect(effects.validateBasketAndContinueCheckout$).toBeObservable(expected$);
    });

    describe('handleBasketNotFoundError$', () => {
      it('should navigate to (empty) /basket after ContinueCheckoutFail if basket expired or could not be found', done => {
        const action = continueCheckoutFail({
          error: makeHttpError({ message: 'invalid', code: 'basket.not_found.error' }),
        });
        actions$ = of(action);

        effects.handleBasketNotFoundError$.pipe(toArray()).subscribe({
          next: actions => {
            expect(actions).toMatchInlineSnapshot(`
            [Basket API] Load Basket Fail:
              error: {"name":"HttpErrorResponse","message":"invalid","code":"bask...
            `);

            expect(location.path()).toMatchInlineSnapshot(`"/basket?error=true"`);

            done();
          },
          error: fail,
          complete: noop,
        });
      });

      it('should navigate to (empty) /basket after StartCheckoutFail if basket expired or could not be found', done => {
        const action = startCheckoutFail({
          error: makeHttpError({ message: 'invalid', code: 'basket.not_found.error' }),
        });
        actions$ = of(action);

        effects.handleBasketNotFoundError$.pipe(toArray()).subscribe({
          next: actions => {
            expect(actions).toMatchInlineSnapshot(`
            [Basket API] Load Basket Fail:
              error: {"name":"HttpErrorResponse","message":"invalid","code":"bask...
            `);

            expect(location.path()).toMatchInlineSnapshot(`"/basket?error=true"`);

            done();
          },
          error: fail,
          complete: noop,
        });
      });
    });
  });
});
