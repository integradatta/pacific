import { Module } from '@nestjs/common';
import { GEO_DB, GeoDbPg } from './common/geo-db.js';
import { GroupsController } from './modules/groups/groups.controller.js';
import { GroupsService } from './modules/groups/groups.service.js';
import { SharingController } from './modules/sharing/sharing.controller.js';
import { SharingService } from './modules/sharing/sharing.service.js';
import { LocationsController } from './modules/locations/locations.controller.js';
import { LocationsService } from './modules/locations/locations.service.js';
import { GeofencingController } from './modules/geofencing/geofencing.controller.js';
import { GeofencingService } from './modules/geofencing/geofencing.service.js';

@Module({
  controllers: [GroupsController, SharingController, LocationsController, GeofencingController],
  providers: [
    { provide: GEO_DB, useClass: GeoDbPg },
    GroupsService,
    SharingService,
    LocationsService,
    GeofencingService,
  ],
})
export class AppModule {}
