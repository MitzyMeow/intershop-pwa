import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { ProductContextFacade } from 'ish-core/facades/product-context.facade';
import { SkuQuantityType } from 'ish-core/models/product/product.model';

@Component({
  selector: 'ish-product-bundle-parts',
  templateUrl: './product-bundle-parts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductBundlePartsComponent implements OnInit {
  parts$: Observable<SkuQuantityType[]>;
  visible$: Observable<boolean>;

  constructor(private context: ProductContextFacade) {}

  ngOnInit() {
    this.parts$ = this.context.select('parts');
    this.visible$ = this.context.select('displayProperties', 'bundleParts');
  }
}
