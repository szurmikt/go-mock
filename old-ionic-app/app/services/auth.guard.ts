import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  CanActivate,
  Router,
  NavigationEnd,
} from '@angular/router';
import { Observable } from 'rxjs';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(public userService: UserService, public router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    console.log('next', next);
    console.log('state', state);

    let property = this.userService.getProperty();

    if (property == undefined) {
      return this.userService.loadProperty().then((_) => {
        property = this.userService.getProperty();
        console.log('AFTER loadProperty property', property);
        if (property == undefined) {
          this.router.navigate(['login']);
          return false;
        }
        return true;
      });
    }
    return true;
  }
}
